const mongoose = require('mongoose');

const reviewCommentSchema = new mongoose.Schema({
  file: {
    type: String,
    required: true
  },
  line: {
    type: Number,
    required: true
  },
  severity: {
    type: String,
    enum: ['error', 'warning', 'suggestion'],
    default: 'suggestion'
  },
  category: {
    type: String,
    enum: ['security', 'performance', 'readability', 'best-practices', 'testing', 'documentation', 'bug', 'maintainability'],
    default: 'general'
  },
  comment: {
    type: String,
    required: true
  },
  suggestion: {
    type: String,
    default: null
  }
});

const reviewSchema = new mongoose.Schema({
  // PR Identification
  pullRequestId: {
    type: Number,
    required: true
  },
  repository: {
    type: String,
    required: true
  },
  owner: {
    type: String,
    required: true
  },
  repo: {
    type: String,
    required: true
  },
  
  // PR Information
  prInfo: {
    title: String,
    description: String,
    author: String,
    baseBranch: String,
    headBranch: String,
    commitSha: String
  },

  // Review Data
  comments: [reviewCommentSchema],
  summaryComment: String,
  
  // Status Tracking
  status: {
    type: String,
    enum: ['pending', 'in_progress', 'completed', 'failed', 'skipped'],
    default: 'pending'
  },
  
  // GitHub Integration
  githubReviewId: Number,
  
  // Metadata
  reviewStartedAt: {
    type: Date,
    default: Date.now
  },
  reviewCompletedAt: Date,
  
  // Error Information
  errorMessage: String,
  retryCount: {
    type: Number,
    default: 0
  },
  
  // Configuration used for this review
  reviewCriteria: {
    checkSecurity: { type: Boolean, default: true },
    checkPerformance: { type: Boolean, default: true },
    checkReadability: { type: Boolean, default: true },
    checkBestPractices: { type: Boolean, default: true },
    checkTesting: { type: Boolean, default: true },
    checkDocumentation: { type: Boolean, default: true }
  },
  
  // Files reviewed
  filesReviewed: [{
    filePath: String,
    status: String,
    additions: Number,
    deletions: Number,
    changes: Number
  }]
}, {
  timestamps: true,
  indexes: [
    { pullRequestId: 1, repository: 1 },
    { status: 1 },
    { createdAt: -1 }
  ]
});

// Compound index for unique PR reviews
reviewSchema.index({ pullRequestId: 1, repository: 1 }, { unique: true });

// Methods
reviewSchema.methods.markInProgress = function() {
  this.status = 'in_progress';
  this.reviewStartedAt = new Date();
  return this.save();
};

reviewSchema.methods.markCompleted = function(githubReviewId) {
  this.status = 'completed';
  this.reviewCompletedAt = new Date();
  if (githubReviewId) {
    this.githubReviewId = githubReviewId;
  }
  return this.save();
};

reviewSchema.methods.markFailed = function(errorMessage) {
  this.status = 'failed';
  this.errorMessage = errorMessage;
  this.reviewCompletedAt = new Date();
  return this.save();
};

reviewSchema.methods.incrementRetry = function() {
  this.retryCount += 1;
  this.status = 'pending';
  this.errorMessage = null;
  return this.save();
};

// Static methods
reviewSchema.statics.findByPR = function(owner, repo, pullRequestId) {
  return this.findOne({
    owner,
    repo,
    pullRequestId
  });
};

reviewSchema.statics.getPendingReviews = function() {
  return this.find({ status: 'pending' })
    .sort({ createdAt: 1 })
    .limit(10);
};

reviewSchema.statics.getReviewStats = function(days = 30) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  
  return this.aggregate([
    {
      $match: {
        createdAt: { $gte: startDate }
      }
    },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
        avgRetries: { $avg: '$retryCount' }
      }
    }
  ]);
};

const Review = mongoose.model('Review', reviewSchema);

module.exports = Review;
