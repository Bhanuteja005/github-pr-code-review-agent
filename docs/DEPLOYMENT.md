# Deployment Guide

This guide covers various deployment options for the Code Review Agent.

## Prerequisites

Before deploying, ensure you have:
- GitHub Personal Access Token
- Gemini API Key  
- MongoDB instance
- Domain/URL for webhook endpoint

## Environment Variables

Required environment variables for production:

```env
# Server
PORT=3000
NODE_ENV=production
WEBHOOK_URL=https://your-domain.com/webhook/github

# GitHub
GITHUB_TOKEN=your_github_token
GITHUB_WEBHOOK_SECRET=your_webhook_secret

# Gemini AI
GEMINI_API_KEY=your_gemini_key

# Database
MONGODB_URI=your_mongodb_connection_string
```

## Deployment Options

### 1. Vercel (Recommended for Serverless)

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel --prod
```

**vercel.json:**
```json
{
  "version": 2,
  "builds": [
    {
      "src": "src/index.js",
      "use": "@vercel/node"
    }
  ],
  "routes": [
    {
      "src": "/(.*)",
      "dest": "src/index.js"
    }
  ],
  "env": {
    "NODE_ENV": "production"
  }
}
```

### 2. Railway

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login and deploy
railway login
railway deploy
```

### 3. Heroku

```bash
# Create app
heroku create your-app-name

# Set environment variables
heroku config:set GITHUB_TOKEN=your_token
heroku config:set GEMINI_API_KEY=your_key

# Deploy
git push heroku main
```

**Procfile:**
```
web: npm start
```

### 4. Google Cloud Run

```bash
# Build and push image
docker build -t gcr.io/your-project/code-review-agent .
docker push gcr.io/your-project/code-review-agent

# Deploy
gcloud run deploy code-review-agent \
  --image gcr.io/your-project/code-review-agent \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated
```

### 5. AWS Lambda (with Serverless Framework)

```bash
# Install Serverless
npm install -g serverless

# Deploy
serverless deploy
```

**serverless.yml:**
```yaml
service: code-review-agent

provider:
  name: aws
  runtime: nodejs18.x
  region: us-east-1

functions:
  app:
    handler: src/lambda.handler
    events:
      - http:
          path: /{proxy+}
          method: ANY
```

### 6. DigitalOcean App Platform

Create **app.yaml:**
```yaml
name: code-review-agent
services:
- name: api
  source_dir: /
  github:
    repo: your-username/code-review-agent
    branch: main
  run_command: npm start
  environment_slug: node-js
  instance_count: 1
  instance_size_slug: basic-xxs
  envs:
  - key: NODE_ENV
    value: production
```

## Database Options

### MongoDB Atlas (Recommended)
1. Create cluster at mongodb.com
2. Get connection string
3. Set as MONGODB_URI

### Railway PostgreSQL
```bash
railway add postgresql
```

### PlanetScale MySQL
```bash
# Install CLI
npm install -g @planetscale/cli

# Create database
pscale database create code-review-agent
```

## SSL/HTTPS Setup

Most platforms provide HTTPS automatically. For custom deployments:

```nginx
server {
    listen 443 ssl;
    server_name your-domain.com;
    
    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

## Monitoring

### Health Checks
```bash
curl https://your-domain.com/health
```

### Logging
- Use cloud provider logging (CloudWatch, Vercel Analytics)
- Consider external services (LogDNA, Papertrail)

### Error Tracking
- Sentry integration:
```javascript
const Sentry = require('@sentry/node');
Sentry.init({ dsn: 'your_dsn' });
```

## Security Checklist

- [ ] Environment variables secured
- [ ] Webhook secret configured
- [ ] Rate limiting enabled
- [ ] HTTPS enforced
- [ ] Database access restricted
- [ ] Regular dependency updates

## Scaling Considerations

### Horizontal Scaling
- Use load balancer
- Database connection pooling
- Consider Redis for session storage

### Performance Optimization
- Enable compression
- Implement caching
- Monitor response times
- Use CDN for static assets

## Troubleshooting

### Common Issues

1. **Webhook not receiving events**
   - Check URL accessibility
   - Verify webhook secret
   - Check GitHub webhook delivery logs

2. **Database connection errors**
   - Verify connection string
   - Check network access
   - Monitor connection pool

3. **AI API failures**
   - Check API key validity
   - Monitor rate limits
   - Implement retry logic

### Debug Mode
```env
NODE_ENV=development
LOG_LEVEL=debug
```

## Backup Strategy

1. **Database Backups**
   - Automated daily backups
   - Test restore procedures

2. **Environment Configuration**
   - Document all environment variables
   - Keep secure backup of secrets

3. **Code Repository**
   - Regular git pushes
   - Tag releases
   - Maintain changelog
