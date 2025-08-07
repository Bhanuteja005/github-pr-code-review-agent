# API Documentation

Complete API reference for the Code Review Agent.

## Base URL
```
Production: https://your-domain.com
Development: http://localhost:3000
```

## Authentication

The API uses GitHub Personal Access Tokens for GitHub API access. No authentication required for webhook endpoints.

## Endpoints

### Health Check

**GET** `/health`

Check the health status of the application.

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "version": "1.0.0",
  "database": {
    "status": "healthy"
  }
}
```

### GitHub Webhook

**POST** `/webhook/github`

Receives GitHub webhook events for pull request processing.

**Headers:**
- `X-GitHub-Event`: Event type (e.g., "pull_request")
- `X-GitHub-Delivery`: Unique delivery ID
- `X-Hub-Signature-256`: Webhook signature (if secret configured)

**Supported Events:**
- `ping` - Webhook validation
- `pull_request` - PR opened, synchronize, reopened
- `pull_request_review` - Review submitted

**Response:**
```json
{
  "message": "PR review started",
  "reviewId": "60f7e1b8c8a4f5001f123456",
  "pullRequest": {
    "owner": "username",
    "repo": "repository",
    "number": 123,
    "title": "Add new feature"
  }
}
```

### Get Review Status

**GET** `/api/reviews/:prId`

Get the status and details of a pull request review.

**Parameters:**
- `prId` (path): Pull request number
- `owner` (query): Repository owner
- `repo` (query): Repository name

**Example:**
```
GET /api/reviews/123?owner=username&repo=repository
```

**Response:**
```json
{
  "reviewId": "60f7e1b8c8a4f5001f123456",
  "pullRequest": {
    "id": 123,
    "repository": "username/repository",
    "title": "Add new feature",
    "author": "developer"
  },
  "status": "completed",
  "comments": [
    {
      "file": "src/app.js",
      "line": 42,
      "severity": "warning",
      "category": "performance",
      "comment": "Consider using async/await instead of .then() for better readability.",
      "suggestion": "async function getData() { const result = await fetch(url); return result; }"
    }
  ],
  "summaryComment": "🤖 **Automated Code Review Summary**\n\nFound 1 item(s) to review...",
  "filesReviewed": [
    {
      "filePath": "src/app.js",
      "status": "modified",
      "additions": 10,
      "deletions": 5,
      "changes": 15
    }
  ],
  "reviewStartedAt": "2024-01-01T00:00:00.000Z",
  "reviewCompletedAt": "2024-01-01T00:01:30.000Z",
  "retryCount": 0,
  "errorMessage": null,
  "githubReviewId": 789
}
```

### Retry Review

**POST** `/api/reviews/:prId/retry`

Retry a failed or incomplete review.

**Parameters:**
- `prId` (path): Pull request number
- `owner` (query): Repository owner  
- `repo` (query): Repository name

**Example:**
```
POST /api/reviews/123/retry?owner=username&repo=repository
```

**Response:**
```json
{
  "message": "Review retry initiated",
  "reviewId": "60f7e1b8c8a4f5001f123456",
  "retryCount": 1
}
```

## Response Codes

| Code | Description |
|------|-------------|
| 200 | Success |
| 400 | Bad Request - Invalid parameters |
| 401 | Unauthorized - Invalid webhook signature |
| 404 | Not Found - Review or resource not found |
| 429 | Too Many Requests - Rate limit exceeded |
| 500 | Internal Server Error |

## Error Format

All errors follow a consistent format:

```json
{
  "error": {
    "message": "Error description",
    "status": 400,
    "timestamp": "2024-01-01T00:00:00.000Z",
    "requestId": "abc-123-def"
  }
}
```

## Review Status Values

| Status | Description |
|--------|-------------|
| `pending` | Review queued for processing |
| `in_progress` | Currently being reviewed |
| `completed` | Review finished successfully |
| `failed` | Review failed with error |
| `skipped` | Review skipped (draft PR, etc.) |

## Comment Severity Levels

| Severity | Description | Emoji |
|----------|-------------|-------|
| `error` | Critical issues requiring fixes | 🔴 |
| `warning` | Important suggestions | 🟡 |
| `suggestion` | Minor improvements | 💡 |

## Review Categories

| Category | Description | Emoji |
|----------|-------------|-------|
| `security` | Security vulnerabilities | 🔒 |
| `performance` | Performance optimizations | ⚡ |
| `readability` | Code readability improvements | 📖 |
| `best-practices` | Language/framework best practices | ✨ |
| `testing` | Test coverage and quality | 🧪 |
| `documentation` | Documentation improvements | 📝 |

## Webhooks

### Configuring GitHub Webhooks

1. Go to repository Settings → Webhooks
2. Add webhook with URL: `https://your-domain.com/webhook/github`
3. Content type: `application/json`
4. Secret: Your webhook secret (optional but recommended)
5. Events: Select "Pull requests" and "Pull request reviews"

### Webhook Security

The agent verifies webhook signatures using HMAC-SHA256:

```javascript
const crypto = require('crypto');
const signature = crypto
  .createHmac('sha256', webhookSecret)
  .update(payload)
  .digest('hex');
```

### Webhook Retry Policy

GitHub retries webhook deliveries:
- Immediately
- After 1 minute
- After 5 minutes  
- After 15 minutes
- After 1 hour

Ensure your endpoint responds with 200 status to prevent retries.

## Rate Limiting

### GitHub API Limits
- 5,000 requests per hour for authenticated requests
- Monitor `X-RateLimit-*` headers

### Gemini API Limits
- Varies by model and tier
- Implement exponential backoff

### Application Rate Limits
- 100 requests per 15 minutes per IP
- Webhook endpoints have separate limits

## Monitoring & Observability

### Metrics to Track
- Review processing time
- Success/failure rates
- API response times
- Database connection health

### Logging Levels
- `error`: Critical errors
- `warn`: Important warnings
- `info`: General information
- `debug`: Detailed debugging

### Health Check Details
```json
{
  "status": "healthy",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "version": "1.0.0",
  "database": {
    "status": "healthy",
    "responseTime": "15ms"
  },
  "services": {
    "github": "available",
    "gemini": "available"
  }
}
```

## SDKs and Libraries

### Node.js Client Example

```javascript
const axios = require('axios');

class CodeReviewClient {
  constructor(baseURL) {
    this.client = axios.create({ baseURL });
  }

  async getReviewStatus(prId, owner, repo) {
    const response = await this.client.get(`/api/reviews/${prId}`, {
      params: { owner, repo }
    });
    return response.data;
  }

  async retryReview(prId, owner, repo) {
    const response = await this.client.post(`/api/reviews/${prId}/retry`, null, {
      params: { owner, repo }
    });
    return response.data;
  }
}

// Usage
const client = new CodeReviewClient('https://your-domain.com');
const review = await client.getReviewStatus(123, 'owner', 'repo');
```

### Python Client Example

```python
import requests

class CodeReviewClient:
    def __init__(self, base_url):
        self.base_url = base_url
        
    def get_review_status(self, pr_id, owner, repo):
        response = requests.get(
            f"{self.base_url}/api/reviews/{pr_id}",
            params={"owner": owner, "repo": repo}
        )
        return response.json()
        
    def retry_review(self, pr_id, owner, repo):
        response = requests.post(
            f"{self.base_url}/api/reviews/{pr_id}/retry",
            params={"owner": owner, "repo": repo}
        )
        return response.json()

# Usage
client = CodeReviewClient("https://your-domain.com")
review = client.get_review_status(123, "owner", "repo")
```

## OpenAPI Specification

A complete OpenAPI 3.0 specification is available at:
```
GET /api/docs/openapi.json
```

Swagger UI documentation:
```
GET /api/docs
```
