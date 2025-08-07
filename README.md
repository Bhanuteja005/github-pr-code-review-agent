# 🤖 Code Review Agent - AI-Powered PR Reviewer

An intelligent **Code Review Agent** that automatically reviews GitHub pull requests using **Gemini 2.5 Pro**, checks for coding best practices, and posts detailed feedback directly on PRs.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Node.js](https://img.shields.io/badge/node-%3E%3D18.0.0-green.svg)
![MongoDB](https://img.shields.io/badge/database-MongoDB-green.svg)

## 🚀 Features

### 🧠 AI-Powered Analysis
- **Gemini 2.5 Pro Integration**: Advanced semantic code understanding
- **Multi-Language Support**: JavaScript, TypeScript, Python, Java, and more
- **Context-Aware Reviews**: Understands code context and relationships

### 🔍 Comprehensive Review Criteria
- **Security Vulnerabilities**: Detects potential security issues
- **Performance Optimization**: Identifies performance bottlenecks
- **Code Readability**: Suggests improvements for maintainability
- **Best Practices**: Enforces language/framework conventions
- **Test Coverage**: Reviews testing approaches
- **Documentation**: Checks code documentation quality

### 🔄 Automated Workflow
- **GitHub Webhooks**: Automatic PR detection and processing
- **Real-time Comments**: Posts inline feedback directly on GitHub
- **State Management**: Tracks review progress and avoids duplicates
- **Retry Mechanism**: Handles failures gracefully with retry logic

### 🛡️ Enterprise-Ready
- **Secure Webhook Validation**: Verifies GitHub webhook signatures
- **Rate Limiting**: Protects against API abuse
- **Comprehensive Logging**: Structured logging with Winston
- **Error Handling**: Robust error management and recovery

## 📋 Requirements

- **Node.js** >= 18.0.0
- **MongoDB** >= 4.4
- **GitHub Token** with repository permissions
- **Gemini API Key** from Google AI Studio

## 🛠️ Installation

### 1. Clone the Repository
```bash
git clone <your-repo-url>
cd code-review-agent
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Configure Environment
```bash
# Copy the example environment file
copy .env.example .env

# Edit .env with your configuration
notepad .env
```

### 4. Required Environment Variables
```env
# GitHub Configuration
GITHUB_TOKEN=your_github_personal_access_token
GITHUB_WEBHOOK_SECRET=your_webhook_secret

# Gemini AI Configuration  
GEMINI_API_KEY=your_gemini_api_key

# Database
MONGODB_URI=mongodb://localhost:27017/code-review-agent
```

### 5. Start MongoDB
```bash
# Windows (if MongoDB is installed locally)
net start MongoDB

# Or use Docker
docker run -d -p 27017:27017 --name mongodb mongo:latest
```

### 6. Run the Application
```bash
# Development mode with auto-reload
npm run dev

# Production mode
npm start
```

## 🔧 Configuration

### GitHub Setup

1. **Create a Personal Access Token**:
   - Go to GitHub Settings → Developer settings → Personal access tokens
   - Generate a token with `repo` permissions
   - Add token to `.env` as `GITHUB_TOKEN`

2. **Set up Webhook**:
   - In your repository, go to Settings → Webhooks
   - Add webhook URL: `https://your-domain.com/webhook/github`
   - Content type: `application/json`
   - Events: `Pull requests` and `Pull request reviews`
   - Add secret and update `.env` as `GITHUB_WEBHOOK_SECRET`

### Gemini AI Setup

1. **Get API Key**:
   - Visit [Google AI Studio](https://makersuite.google.com/app/apikey)
   - Create a new API key
   - Add to `.env` as `GEMINI_API_KEY`

## 🚀 Usage

### Basic Workflow

1. **Open a Pull Request** in your configured repository
2. **Agent Automatically Detects** the PR via webhook
3. **AI Analysis** runs using Gemini 2.5 Pro
4. **Comments Posted** directly on the PR with feedback
5. **Review State Tracked** in MongoDB

### API Endpoints

```bash
# Health check
GET /health

# GitHub webhook endpoint
POST /webhook/github

# Get review status
GET /api/reviews/:prId?owner=:owner&repo=:repo

# Retry failed review
POST /api/reviews/:prId/retry?owner=:owner&repo=:repo
```

### Example Review Output

The agent posts intelligent comments like:

```markdown
🔴 **SECURITY**: Avoid using `eval()` as it can execute arbitrary code and poses security risks.

**Suggestion:**
```javascript
// Instead of: eval(userInput)
// Use: JSON.parse(userInput) or a proper expression parser
```
```

## 🏗️ Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   GitHub PR     │───▶│  Webhook Handler │───▶│  Review Queue   │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                                │                        │
                                ▼                        ▼
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│  GitHub API     │◀───│   PR Analyzer    │◀───│ Gemini 2.5 Pro  │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                                │                        │
                                ▼                        ▼
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Comments      │◀───│  Comment Poster  │    │    MongoDB      │
└─────────────────┘    └──────────────────┘    └─────────────────┘
```

## 🧪 Testing

```bash
# Run tests
npm test

# Run tests in watch mode
npm run test:watch

# Run linting
npm run lint

# Fix linting issues
npm run lint:fix

# Format code
npm run format
```

## 📦 Deployment

### Docker Deployment

```dockerfile
# Dockerfile included in project
docker build -t code-review-agent .
docker run -p 3000:3000 --env-file .env code-review-agent
```

### Cloud Platforms

- **Vercel**: Zero-config deployment
- **AWS Lambda**: Serverless deployment
- **Google Cloud Run**: Container deployment
- **Heroku**: Simple PaaS deployment

## 🔍 Monitoring

### Health Checks
```bash
curl http://localhost:3000/health
```

### Logs
- Application logs: `logs/combined.log`
- Error logs: `logs/error.log`
- Console logs in development mode

### Database Monitoring
```bash
# Review statistics
GET /api/stats

# Active reviews
GET /api/reviews/active
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit changes: `git commit -m 'Add amazing feature'`
4. Push to branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

- **Documentation**: Check the `/docs` folder for detailed guides
- **Issues**: Report bugs via GitHub Issues
- **Discussions**: Use GitHub Discussions for questions

## 🔮 Roadmap

- [ ] **Custom Rules Engine**: Team-specific coding guidelines
- [ ] **Dashboard UI**: Web interface for review management  
- [ ] **Multi-Repository Support**: Manage multiple repositories
- [ ] **Learning Mode**: Improve review quality over time
- [ ] **Slack/Teams Integration**: Notifications and summaries
- [ ] **Code Quality Metrics**: Track improvement over time

---

**Built with ❤️ using Gemini 2.5 Pro and Node.js**
