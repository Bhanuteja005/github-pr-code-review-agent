# 🚀 Quick Start Guide

Get your Code Review Agent up and running in 5 minutes!

## Prerequisites

- ✅ **Node.js 18+** installed
- ✅ **GitHub account** with repository access
- ✅ **Google AI Studio account** for Gemini API
- ✅ **MongoDB** (local or cloud)

## Step 1: Clone & Install

```bash
# Clone the repository
git clone <your-repo-url>
cd code-review-agent

# Install dependencies
npm install
```

## Step 2: Quick Setup

Run the interactive setup script:

```bash
npm run setup
```

Or manually configure `.env`:

```env
# Copy from example
copy .env.example .env

# Edit with your values
GITHUB_TOKEN=your_github_token_here
GEMINI_API_KEY=your_gemini_api_key_here
MONGODB_URI=mongodb://localhost:27017/code-review-agent
```

## Step 3: Get API Keys

### GitHub Token
1. Go to [GitHub Settings > Tokens](https://github.com/settings/tokens)
2. Generate new token with `repo` permissions
3. Copy token to `.env`

### Gemini API Key
1. Visit [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Create new API key
3. Copy key to `.env`

## Step 4: Start MongoDB

**Option A: Local MongoDB**
```bash
# Windows
net start MongoDB

# macOS/Linux
sudo systemctl start mongod
```

**Option B: Docker**
```bash
docker run -d -p 27017:27017 --name mongodb mongo:latest
```

**Option C: MongoDB Atlas**
1. Create free cluster at [mongodb.com](https://www.mongodb.com/cloud/atlas)
2. Get connection string
3. Update `MONGODB_URI` in `.env`

## Step 5: Run the Agent

```bash
# Development mode (with auto-reload)
npm run dev

# Production mode
npm start
```

You should see:
```
🤖 Code Review Agent started on port 3000
🔗 Webhook URL: http://localhost:3000/webhook/github
```

## Step 6: Test Locally

Open a new terminal and test the health endpoint:

```bash
curl http://localhost:3000/health
```

Expected response:
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

## Step 7: Set Up GitHub Webhook

### For Local Testing (using ngrok)

1. **Install ngrok**: [ngrok.com/download](https://ngrok.com/download)
2. **Expose local server**:
   ```bash
   ngrok http 3000
   ```
3. **Copy the HTTPS URL** (e.g., `https://abc123.ngrok.io`)

### Configure Webhook

1. Go to your repository **Settings → Webhooks**
2. Click **"Add webhook"**
3. Configure:
   - **Payload URL**: `https://your-domain.com/webhook/github`
   - **Content type**: `application/json`
   - **Secret**: Your webhook secret (optional)
   - **Events**: Select "Pull requests" and "Pull request reviews"
4. Click **"Add webhook"**

## Step 8: Test with a Pull Request

1. **Create a test branch**:
   ```bash
   git checkout -b test-review
   ```

2. **Make some changes** (add a simple file):
   ```bash
   echo "console.log('Hello World');" > test.js
   git add test.js
   git commit -m "Add test file"
   git push origin test-review
   ```

3. **Open a Pull Request** on GitHub

4. **Watch the magic happen!** 🎉
   - The agent will automatically detect the PR
   - Analyze the code using Gemini AI
   - Post review comments

## Troubleshooting

### Common Issues

**❌ "Missing required environment variables"**
- Check `.env` file exists and has correct values
- Verify API keys are valid

**❌ "Database connection error"**
- Ensure MongoDB is running
- Check connection string in `MONGODB_URI`

**❌ "Webhook not receiving events"**
- Verify webhook URL is accessible
- Check webhook delivery logs in GitHub
- Ensure correct event types are selected

**❌ "Gemini API errors"**
- Verify API key is correct
- Check rate limits
- Ensure you have credits/quota

### Debug Mode

Enable detailed logging:
```env
NODE_ENV=development
LOG_LEVEL=debug
```

### Test Webhook Manually

Use the test script:
```bash
node scripts/test-webhook.js
```

## Next Steps

✅ **Production Deployment**: See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)
✅ **API Documentation**: See [docs/API.md](docs/API.md)
✅ **Customization**: Edit review criteria in `.env`
✅ **Monitoring**: Set up health checks and logging

## Need Help?

- 📖 **Documentation**: Check the `/docs` folder
- 🐛 **Issues**: Report bugs via GitHub Issues
- 💬 **Discussions**: Use GitHub Discussions for questions

---

**🎉 Congratulations! Your AI Code Review Agent is now running!**

Open a pull request in your repository and watch it automatically review your code using Gemini 2.5 Pro.
