<!-- Use this file to provide workspace-specific custom instructions to Copilot. For more details, visit https://code.visualstudio.com/docs/copilot/copilot-customization#_use-a-githubcopilotinstructionsmd-file -->

# Code Review Agent - AI-Powered PR Reviewer

This is a **Code Review Agent** project that uses **Gemini 2.5 Pro** to automatically review GitHub pull requests and post intelligent feedback.

## Project Architecture

- **Backend**: Node.js with Express
- **AI Engine**: Google Gemini 2.5 Pro for code analysis
- **Database**: MongoDB for review state management
- **GitHub Integration**: Webhooks and REST API
- **Deployment**: Configurable for cloud platforms

## Key Components

### Services
- `geminiService.js`: AI-powered code review generation using Gemini 2.5 Pro
- `githubService.js`: GitHub API integration for PR analysis and commenting

### Controllers
- `githubWebhookController.js`: Handles GitHub webhook events and orchestrates review process

### Models
- `Review.js`: MongoDB schema for storing review data and state

### Middleware
- `webhookValidator.js`: Validates GitHub webhook signatures and payloads
- `errorHandler.js`: Centralized error handling with custom error types

## Code Style Guidelines

1. **Async/Await**: Use async/await pattern consistently, avoid callback hell
2. **Error Handling**: Use custom error classes (AppError, GitHubError, GeminiError)
3. **Logging**: Use structured logging with context (winston logger)
4. **Validation**: Validate all inputs, especially webhook payloads
5. **Security**: Always verify webhook signatures, use rate limiting
6. **Documentation**: Include JSDoc comments for all public methods

## AI Integration Notes

- Use Gemini 2.5 Pro for semantic code understanding
- Structure prompts for consistent JSON output
- Handle AI response parsing gracefully
- Implement retry logic for AI failures
- Rate limit AI API calls

## GitHub Integration

- Support both Personal Access Tokens and GitHub Apps
- Handle webhook events: pull_request, pull_request_review
- Post inline comments with proper line positioning
- Manage review state to avoid duplicates
- Handle GitHub API rate limits

When working on this project, focus on:
- **Reliability**: Robust error handling and retry mechanisms
- **Security**: Proper authentication and validation
- **Performance**: Efficient API usage and caching
- **Maintainability**: Clean code structure and comprehensive logging
