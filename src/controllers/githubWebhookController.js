const githubService = require('../services/githubService');
const geminiService = require('../services/geminiService');
const Review = require('../models/Review');
const logger = require('../utils/logger');
const { asyncHandler, AppError, GitHubError, GeminiError } = require('../middleware/errorHandler');

class GitHubWebhookController {
  /**
   * Handle incoming GitHub webhook events
   */
  handleWebhook = asyncHandler(async (req, res) => {
    const { event, delivery, payload } = req.webhook;

    logger.info('Processing webhook event', {
      event,
      delivery,
      repository: payload.repository?.full_name,
      action: payload.action
    });

    try {
      switch (event) {
        case 'ping':
          return this.handlePing(req, res);
        
        case 'pull_request':
          return await this.handlePullRequest(req, res);
        
        case 'pull_request_review':
          return await this.handlePullRequestReview(req, res);
        
        default:
          logger.debug('Unhandled webhook event', { event, action: payload.action });
          return res.status(200).json({ 
            message: 'Event received but not processed',
            event,
            action: payload.action
          });
      }
    } catch (error) {
      logger.error('Error processing webhook', {
        event,
        delivery,
        error: error.message,
        stack: error.stack
      });

      // Send success response to GitHub even on error to prevent retries
      // We'll handle the error internally
      res.status(200).json({ 
        message: 'Webhook received', 
        processed: false,
        error: error.message
      });
    }
  });

  /**
   * Handle ping events from GitHub
   */
  handlePing(req, res) {
    const { payload } = req.webhook;
    
    logger.info('GitHub webhook ping received', {
      zen: payload.zen,
      repository: payload.repository?.full_name
    });

    return res.status(200).json({
      message: 'Pong! Webhook is working correctly.',
      zen: payload.zen
    });
  }

  /**
   * Handle pull request events
   */
  async handlePullRequest(req, res) {
    const { payload } = req.webhook;
    const { action, pull_request, repository } = payload;

    // Only process relevant actions
    const relevantActions = ['opened', 'synchronize', 'reopened'];
    if (!relevantActions.includes(action)) {
      logger.debug('Skipping PR action', { action, pr: pull_request.number });
      return res.status(200).json({ 
        message: 'Action not processed',
        action 
      });
    }

    const owner = repository.owner.login;
    const repo = repository.name;
    const pullNumber = pull_request.number;

    logger.info('Processing pull request event', {
      action,
      owner,
      repo,
      pullNumber,
      title: pull_request.title,
      author: pull_request.user.login
    });

    try {
      // Check if we've already reviewed this PR
      const existingReview = await Review.findByPR(owner, repo, pullNumber);
      
      if (existingReview && existingReview.status === 'completed' && action !== 'synchronize') {
        logger.info('PR already reviewed, skipping', { 
          owner, 
          repo, 
          pullNumber,
          reviewId: existingReview._id
        });
        
        return res.status(200).json({ 
          message: 'PR already reviewed',
          reviewId: existingReview._id
        });
      }

      // Skip draft PRs unless configured otherwise
      if (pull_request.draft) {
        logger.info('Skipping draft PR', { owner, repo, pullNumber });
        return res.status(200).json({ message: 'Draft PR skipped' });
      }

      // Create or update review record
      let review = existingReview;
      if (!review) {
        review = new Review({
          pullRequestId: pullNumber,
          repository: repository.full_name,
          owner,
          repo,
          prInfo: {
            title: pull_request.title,
            description: pull_request.body,
            author: pull_request.user.login,
            baseBranch: pull_request.base.ref,
            headBranch: pull_request.head.ref,
            commitSha: pull_request.head.sha
          }
        });
        await review.save();
      } else {
        // Update PR info for synchronize events
        review.prInfo.commitSha = pull_request.head.sha;
        review.status = 'pending';
        review.errorMessage = null;
        await review.save();
      }

      // Start review process asynchronously
      this.processReviewAsync(owner, repo, pullNumber, review._id)
        .catch(error => {
          logger.error('Async review processing failed', {
            owner,
            repo,
            pullNumber,
            reviewId: review._id,
            error: error.message
          });
        });

      return res.status(200).json({
        message: 'PR review started',
        reviewId: review._id,
        pullRequest: {
          owner,
          repo,
          number: pullNumber,
          title: pull_request.title
        }
      });

    } catch (error) {
      logger.error('Error handling pull request webhook', {
        owner,
        repo,
        pullNumber,
        error: error.message,
        stack: error.stack
      });

      throw new AppError(`Failed to process PR webhook: ${error.message}`, 500);
    }
  }

  /**
   * Handle pull request review events
   */
  async handlePullRequestReview(req, res) {
    const { payload } = req.webhook;
    const { action, review, pull_request, repository } = payload;

    logger.info('Pull request review event', {
      action,
      reviewer: review.user.login,
      state: review.state,
      pullNumber: pull_request.number,
      repository: repository.full_name
    });

    // For now, just log the event
    // Future: Handle review feedback, update review records, etc.

    return res.status(200).json({
      message: 'PR review event received',
      action,
      reviewer: review.user.login
    });
  }

  /**
   * Process code review asynchronously
   */
  async processReviewAsync(owner, repo, pullNumber, reviewId) {
    let review;
    
    try {
      review = await Review.findById(reviewId);
      if (!review) {
        throw new Error('Review record not found');
      }

      await review.markInProgress();

      logger.info('Starting code review process', {
        owner,
        repo,
        pullNumber,
        reviewId
      });

      // Check if already reviewed by our bot
      const alreadyReviewed = await githubService.hasAlreadyReviewed(owner, repo, pullNumber);
      if (alreadyReviewed) {
        logger.info('Bot has already reviewed this PR', { owner, repo, pullNumber });
        await review.markCompleted();
        return;
      }

      // Get PR data and files
      const prData = await githubService.getPullRequestData(owner, repo, pullNumber);
      
      // Update review record with files
      review.filesReviewed = prData.diff_files.map(file => ({
        filePath: file.file_path,
        status: file.status,
        additions: file.additions,
        deletions: file.deletions,
        changes: file.changes
      }));
      await review.save();

      // Skip if no reviewable files
      if (prData.diff_files.length === 0) {
        logger.info('No reviewable files found', { owner, repo, pullNumber });
        await review.markCompleted();
        return;
      }

      // Generate review using Gemini AI
      const comments = await geminiService.generateReview(prData);
      
      // Generate summary comment
      const summaryComment = await geminiService.generateSummaryComment(comments, prData);

      // Update review record
      review.comments = comments;
      review.summaryComment = summaryComment;
      await review.save();

      // Post review to GitHub
      const githubReview = await githubService.postReviewComments(
        owner,
        repo,
        pullNumber,
        comments,
        summaryComment
      );

      // Mark review as completed
      await review.markCompleted(githubReview.id);

      logger.info('Code review completed successfully', {
        owner,
        repo,
        pullNumber,
        reviewId,
        commentsCount: comments.length,
        githubReviewId: githubReview.id
      });

    } catch (error) {
      logger.error('Code review process failed', {
        owner,
        repo,
        pullNumber,
        reviewId,
        error: error.message,
        stack: error.stack
      });

      // Post fallback comment if Gemini API is overloaded
      if (error.message.includes('503') || error.message.includes('overloaded')) {
        try {
          await githubService.postFallbackComment(owner, repo, pullNumber);
          logger.info('Posted fallback comment due to AI overload', { owner, repo, pullNumber });
        } catch (fallbackError) {
          logger.error('Failed to post fallback comment', { error: fallbackError.message });
        }
      }

      if (review) {
        await review.markFailed(error.message);
      }

      // Rethrow for upstream handling
      throw error;
    }
  }

  /**
   * Get review status for a PR
   */
  getReviewStatus = asyncHandler(async (req, res) => {
    const { prId } = req.params;
    const { owner, repo } = req.query;

    if (!owner || !repo) {
      throw new AppError('Owner and repo query parameters are required', 400);
    }

    const review = await Review.findByPR(owner, repo, parseInt(prId));
    
    if (!review) {
      throw new AppError('Review not found', 404);
    }

    return res.json({
      reviewId: review._id,
      pullRequest: {
        id: review.pullRequestId,
        repository: review.repository,
        title: review.prInfo.title,
        author: review.prInfo.author
      },
      status: review.status,
      comments: review.comments,
      summaryComment: review.summaryComment,
      filesReviewed: review.filesReviewed,
      reviewStartedAt: review.reviewStartedAt,
      reviewCompletedAt: review.reviewCompletedAt,
      retryCount: review.retryCount,
      errorMessage: review.errorMessage,
      githubReviewId: review.githubReviewId
    });
  });

  /**
   * Retry a failed review
   */
  retryReview = asyncHandler(async (req, res) => {
    const { prId } = req.params;
    const { owner, repo } = req.query;

    if (!owner || !repo) {
      throw new AppError('Owner and repo query parameters are required', 400);
    }

    const review = await Review.findByPR(owner, repo, parseInt(prId));
    
    if (!review) {
      throw new AppError('Review not found', 404);
    }

    if (review.status === 'completed') {
      throw new AppError('Review already completed', 400);
    }

    if (review.status === 'in_progress') {
      throw new AppError('Review already in progress', 400);
    }

    // Increment retry count
    await review.incrementRetry();

    // Start review process
    this.processReviewAsync(owner, repo, parseInt(prId), review._id)
      .catch(error => {
        logger.error('Retry review failed', {
          owner,
          repo,
          prId,
          reviewId: review._id,
          error: error.message
        });
      });

    return res.json({
      message: 'Review retry initiated',
      reviewId: review._id,
      retryCount: review.retryCount
    });
  });
}

module.exports = new GitHubWebhookController();
