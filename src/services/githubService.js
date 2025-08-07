const { Octokit } = require('@octokit/rest');
const config = require('../config/config');
const logger = require('../utils/logger');

class GitHubService {
  constructor() {
    this.octokit = new Octokit({
      auth: config.GITHUB_TOKEN,
      userAgent: 'Code-Review-Agent/1.0.0'
    });
  }

  /**
   * Get pull request details and files
   * @param {string} owner - Repository owner
   * @param {string} repo - Repository name
   * @param {number} pullNumber - Pull request number
   * @returns {Promise<Object>} PR data with files and diffs
   */
  async getPullRequestData(owner, repo, pullNumber) {
    try {
      logger.info('Fetching PR data', { owner, repo, pullNumber });

      // Get PR details
      const { data: pullRequest } = await this.octokit.rest.pulls.get({
        owner,
        repo,
        pull_number: pullNumber
      });

      // Get PR files
      const { data: files } = await this.octokit.rest.pulls.listFiles({
        owner,
        repo,
        pull_number: pullNumber,
        per_page: config.MAX_FILES_PER_PR
      });

      // Filter out files that are too large or binary
      const reviewableFiles = files.filter(file => {
        if (file.status === 'removed') return false;
        if (file.changes > 1000) { // Skip very large files
          logger.warn('Skipping large file', { 
            file: file.filename, 
            changes: file.changes 
          });
          return false;
        }
        if (this.isBinaryFile(file.filename)) {
          logger.debug('Skipping binary file', { file: file.filename });
          return false;
        }
        return true;
      });

      // Get detailed diff for each file
      const diffFiles = await Promise.all(
        reviewableFiles.map(async (file) => {
          try {
            const diff = await this.getFileDiff(owner, repo, file, pullRequest);
            return {
              file_path: file.filename,
              status: file.status,
              additions: file.additions,
              deletions: file.deletions,
              changes: file.changes,
              diff: diff,
              patch: file.patch
            };
          } catch (error) {
            logger.warn('Failed to get diff for file', {
              file: file.filename,
              error: error.message
            });
            return null;
          }
        })
      );

      const validDiffFiles = diffFiles.filter(file => file !== null);

      logger.info('PR data fetched successfully', {
        owner,
        repo,
        pullNumber,
        totalFiles: files.length,
        reviewableFiles: validDiffFiles.length
      });

      return {
        pull_request_id: pullNumber,
        repository: `${owner}/${repo}`,
        pr_info: {
          title: pullRequest.title,
          description: pullRequest.body,
          author: pullRequest.user.login,
          base_branch: pullRequest.base.ref,
          head_branch: pullRequest.head.ref,
          created_at: pullRequest.created_at,
          updated_at: pullRequest.updated_at
        },
        diff_files: validDiffFiles
      };

    } catch (error) {
      logger.error('Error fetching PR data', {
        owner,
        repo,
        pullNumber,
        error: error.message,
        stack: error.stack
      });
      throw new Error(`Failed to fetch PR data: ${error.message}`);
    }
  }

  /**
   * Get file diff content
   * @param {string} owner - Repository owner
   * @param {string} repo - Repository name
   * @param {Object} file - File object from GitHub API
   * @param {Object} pullRequest - Pull request object
   * @returns {Promise<string>} File diff
   */
  async getFileDiff(owner, repo, file, pullRequest) {
    try {
      // Use the patch from the file object if available
      if (file.patch) {
        return file.patch;
      }

      // Fallback: get file content from both base and head
      const [baseContent, headContent] = await Promise.all([
        this.getFileContent(owner, repo, file.filename, pullRequest.base.sha).catch(() => ''),
        this.getFileContent(owner, repo, file.filename, pullRequest.head.sha).catch(() => '')
      ]);

      // Simple diff representation
      return `--- a/${file.filename}\n+++ b/${file.filename}\n${headContent}`;
    } catch (error) {
      logger.warn('Error getting file diff', {
        file: file.filename,
        error: error.message
      });
      return '';
    }
  }

  /**
   * Get file content at specific commit
   * @param {string} owner - Repository owner
   * @param {string} repo - Repository name
   * @param {string} path - File path
   * @param {string} ref - Git reference (commit SHA, branch, tag)
   * @returns {Promise<string>} File content
   */
  async getFileContent(owner, repo, path, ref) {
    try {
      const { data } = await this.octokit.rest.repos.getContent({
        owner,
        repo,
        path,
        ref
      });

      if (data.type === 'file') {
        return Buffer.from(data.content, 'base64').toString('utf8');
      }
      return '';
    } catch (error) {
      if (error.status === 404) {
        return ''; // File doesn't exist in this ref
      }
      throw error;
    }
  }

  /**
   * Post review comments on a pull request
   * @param {string} owner - Repository owner
   * @param {string} repo - Repository name
   * @param {number} pullNumber - Pull request number
   * @param {Array} comments - Array of review comments
   * @param {string} summaryComment - Overall review summary
   * @returns {Promise<void>}
   */
  async postReviewComments(owner, repo, pullNumber, comments, summaryComment) {
    try {
      logger.info('Posting review comments', {
        owner,
        repo,
        pullNumber,
        commentsCount: comments.length
      });

      // Get the latest commit SHA for the PR
      const { data: pullRequest } = await this.octokit.rest.pulls.get({
        owner,
        repo,
        pull_number: pullNumber
      });

      const commitSha = pullRequest.head.sha;

      // Prepare inline comments
      const reviewComments = await this.prepareInlineComments(
        owner,
        repo,
        pullNumber,
        comments,
        commitSha
      );

      // Create the review
      const reviewBody = summaryComment || 'Automated code review completed.';
      
      const reviewData = {
        owner,
        repo,
        pull_number: pullNumber,
        commit_id: commitSha,
        body: reviewBody,
        event: 'COMMENT', // Always use COMMENT to avoid GitHub restrictions on own PRs
        comments: reviewComments
      };

      const { data: review } = await this.octokit.rest.pulls.createReview(reviewData);

      logger.info('Review posted successfully', {
        owner,
        repo,
        pullNumber,
        reviewId: review.id,
        commentsPosted: reviewComments.length
      });

      return review;

    } catch (error) {
      logger.error('Error posting review comments', {
        owner,
        repo,
        pullNumber,
        error: error.message,
        stack: error.stack
      });
      throw new Error(`Failed to post review: ${error.message}`);
    }
  }

  /**
   * Prepare inline comments for GitHub review API
   * @param {string} owner - Repository owner
   * @param {string} repo - Repository name
   * @param {number} pullNumber - Pull request number
   * @param {Array} comments - Review comments
   * @param {string} commitSha - Commit SHA
   * @returns {Promise<Array>} Formatted comments for GitHub API
   */
  async prepareInlineComments(owner, repo, pullNumber, comments, commitSha) {
    const reviewComments = [];

    for (const comment of comments) {
      try {
        // Get the position of the line in the diff
        const position = await this.getLinePosition(
          owner,
          repo,
          pullNumber,
          comment.file,
          comment.line
        );

        if (position !== null) {
          const severityEmoji = this.getSeverityEmoji(comment.severity);
          const categoryEmoji = this.getCategoryEmoji(comment.category);
          
          let body = `${severityEmoji} **${comment.category.toUpperCase()}**: ${comment.comment}`;
          
          if (comment.suggestion) {
            body += `\n\n**Suggestion:**\n\`\`\`\n${comment.suggestion}\n\`\`\``;
          }

          reviewComments.push({
            path: comment.file,
            position: position,
            body: body
          });
        } else {
          logger.warn('Could not determine line position for comment', {
            file: comment.file,
            line: comment.line
          });
        }
      } catch (error) {
        logger.warn('Error preparing comment', {
          comment: comment,
          error: error.message
        });
      }
    }

    return reviewComments;
  }

  /**
   * Get the position of a line in the diff for GitHub API
   * @param {string} owner - Repository owner
   * @param {string} repo - Repository name
   * @param {number} pullNumber - Pull request number
   * @param {string} filePath - File path
   * @param {number} lineNumber - Line number
   * @returns {Promise<number|null>} Position in diff or null if not found
   */
  async getLinePosition(owner, repo, pullNumber, filePath, lineNumber) {
    try {
      const { data: files } = await this.octokit.rest.pulls.listFiles({
        owner,
        repo,
        pull_number: pullNumber
      });

      const file = files.find(f => f.filename === filePath);
      if (!file || !file.patch) {
        return null;
      }

      // Parse the patch to find line positions
      const patchLines = file.patch.split('\n');
      let position = 0;
      let currentLine = 0;
      let inHunk = false;

      for (const line of patchLines) {
        if (line.startsWith('@@')) {
          // Parse hunk header: @@ -oldStart,oldCount +newStart,newCount @@
          const match = line.match(/@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
          if (match) {
            currentLine = parseInt(match[1]) - 1;
            inHunk = true;
          }
          position++;
          continue;
        }

        if (!inHunk) {
          position++;
          continue;
        }

        if (line.startsWith('+')) {
          currentLine++;
          if (currentLine === lineNumber) {
            return position;
          }
        } else if (line.startsWith(' ')) {
          currentLine++;
        }
        // Lines starting with '-' don't increment currentLine as they're deleted

        position++;
      }

      return null;
    } catch (error) {
      logger.warn('Error getting line position', {
        filePath,
        lineNumber,
        error: error.message
      });
      return null;
    }
  }

  /**
   * Check if a file is binary based on its extension
   * @param {string} filename - File name
   * @returns {boolean} True if binary file
   */
  isBinaryFile(filename) {
    const binaryExtensions = [
      '.png', '.jpg', '.jpeg', '.gif', '.bmp', '.ico', '.svg',
      '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
      '.zip', '.tar', '.gz', '.rar', '.7z',
      '.exe', '.dll', '.so', '.dylib',
      '.mp3', '.mp4', '.avi', '.mov', '.mkv',
      '.bin', '.dat', '.db', '.sqlite'
    ];

    const extension = filename.toLowerCase().split('.').pop();
    return binaryExtensions.includes(`.${extension}`);
  }

  /**
   * Get emoji for severity level
   * @param {string} severity - Severity level
   * @returns {string} Emoji
   */
  getSeverityEmoji(severity) {
    const emojiMap = {
      'error': '🔴',
      'warning': '🟡',
      'suggestion': '💡'
    };
    return emojiMap[severity] || '💬';
  }

  /**
   * Get emoji for review category
   * @param {string} category - Review category
   * @returns {string} Emoji
   */
  getCategoryEmoji(category) {
    const emojiMap = {
      'security': '🔒',
      'performance': '⚡',
      'readability': '📖',
      'best-practices': '✨',
      'testing': '🧪',
      'documentation': '📝'
    };
    return emojiMap[category] || '💬';
  }

  /**
   * Check if the agent has already reviewed this PR
   * @param {string} owner - Repository owner
   * @param {string} repo - Repository name
   * @param {number} pullNumber - Pull request number
   * @returns {Promise<boolean>} True if already reviewed
   */
  async hasAlreadyReviewed(owner, repo, pullNumber) {
    try {
      const { data: reviews } = await this.octokit.rest.pulls.listReviews({
        owner,
        repo,
        pull_number: pullNumber
      });

      // Get bot user info first
      const botUser = await this.getBotUser();
      
      // Check if there's a review from our bot user
      const botReviews = reviews.filter(review => 
        review.user.login === botUser.login
      );

      return botReviews.length > 0;
    } catch (error) {
      logger.warn('Error checking existing reviews', {
        owner,
        repo,
        pullNumber,
        error: error.message
      });
      return false;
    }
  }

  /**
   * Get the authenticated user (bot) information
   * @returns {Promise<Object>} User object
   */
  async getBotUser() {
    if (!this.botUser) {
      const { data: user } = await this.octokit.rest.users.getAuthenticated();
      this.botUser = user;
    }
    return this.botUser;
  }

  /**
   * Post a fallback comment when AI service is unavailable
   * @param {string} owner - Repository owner
   * @param {string} repo - Repository name
   * @param {number} pullNumber - Pull request number
   */
  async postFallbackComment(owner, repo, pullNumber) {
    try {
      const comment = `🤖 **AI Code Review Temporarily Unavailable**

I attempted to review this pull request, but the AI service is currently overloaded. 

**What happened?**
- The Gemini AI service is experiencing high traffic (503 Service Unavailable)
- I tried multiple times with exponential backoff but couldn't connect

**What's next?**
- The review will be retried automatically in a few minutes
- You can also manually trigger a retry by pushing a new commit
- Or use the \`/retry\` command in a comment

**Manual Review Checklist:**
- [ ] Check for security vulnerabilities
- [ ] Verify performance optimizations  
- [ ] Ensure code readability and maintainability
- [ ] Follow language/framework best practices
- [ ] Add appropriate tests and documentation

Sorry for the inconvenience! The AI will be back online shortly. 🚀`;

      await this.octokit.rest.issues.createComment({
        owner,
        repo,
        issue_number: pullNumber,
        body: comment
      });

      logger.info('Fallback comment posted successfully', { owner, repo, pullNumber });
    } catch (error) {
      logger.error('Failed to post fallback comment', {
        owner,
        repo,
        pullNumber,
        error: error.message
      });
      throw error;
    }
  }
}

module.exports = new GitHubService();
