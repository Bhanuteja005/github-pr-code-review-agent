 ## 🚀 Setup Commands
 
 ```bash
 # Clone and setup
 git clone https://github.com/Bhanuteja005/github-pr-code-review-agent.git
 cd github-pr-code-review-agent
 npm install
 
 # Configure environment
 cp .env.example .env
 # Edit .env with your credentials
 
 # Start server
 npm start
 
 # Expose publicly (new terminal)
 npx localtunnel --port 3000
 ```
 
 ## 🔧 Development Commands
 
 ```bash
 # Start in development mode
 npm run dev
 
 # Run tests
 npm test
 
 # Health check
 curl http://localhost:3000/health
 
 # Test webhook locally
 $headers = @{'Content-Type'='application/json'; 'X-GitHub-Event'='ping'; 'X-GitHub-Delivery'='test'}
 $body = '{"zen":"test"}'
 Invoke-RestMethod -Uri 'http://localhost:3000/webhook/github' -Method POST -Headers $headers -Body $body
 ```
 
 ## 📝 PR Testing Commands
 
 ```bash
 # Create test PR
 git checkout -b test-review
 echo "var x = 'test';" > test.js
 git add test.js
 git commit -m "Add test file"
 git push origin test-review
 
 # Create PR via GitHub CLI
 gh pr create --title "Test AI Review" --body "Testing code review agent"
 ```
 
 ## 🔍 Monitoring Commands
 
 ```bash
 # Check server status
 curl http://localhost:3000/health
 
 # Get review status (replace with actual values)
 curl "http://localhost:3000/api/reviews/1?owner=username&repo=repository"
 
 # Retry failed review
 curl -X POST "http://localhost:3000/api/reviews/1/retry?owner=username&repo=repository"
 ```
 
 ## 🛠️ Troubleshooting Commands
 
 ```bash
 # Kill all node processes
 taskkill /F /IM node.exe
 
 # Check if port is in use
 netstat -ano | findstr :3000
 
 # Restart everything
 npm start
 # (new terminal) npx localtunnel --port 3000
 
 # Test components individually
 curl http://localhost:3000/health                    # Server
 curl https://your-tunnel-url.loca.lt/health         # Tunnel
 ```
 
 ## 🔄 Webhook Commands
 
 ```bash
 # Test webhook with curl (if available)
 curl -X POST https://your-tunnel-url.loca.lt/webhook/github \
   -H "Content-Type: application/json" \
   -H "X-GitHub-Event: ping" \
   -d '{"zen":"test"}'
 
 # PowerShell webhook test
 $headers = @{
     'Content-Type'='application/json'
     'X-GitHub-Event'='pull_request' 
     'X-GitHub-Delivery'='test-123'
 }
 $body = '{"action":"opened","pull_request":{"number":1,"title":"Test"},"repository":{"name":"test","owner":{"login":"user"}}}'
 Invoke-RestMethod -Uri 'https://your-tunnel-url.loca.lt/webhook/github' -Method POST -Headers $headers -Body $body
 ```
 
 ## 📊 GitHub Webhook Setup
 
 1. **Repository Settings** → **Webhooks** → **Add webhook**
 2. **Payload URL**: `https://your-tunnel-url.loca.lt/webhook/github`  
 3. **Content type**: `application/json`
 4. **Events**: Pull requests + Pull request reviews
 5. **Active**: ✅
 
 ## 🎯 Expected Outputs
 
 **Healthy Server Response:**
 ```json
 {
   "status": "healthy",
   "timestamp": "2025-08-12T14:18:13.163Z",
   "database": { "status": "connected" }
 }
 ```
 
 **Successful Webhook Response:**
 ```json
 {
   "message": "Pong! Webhook is working correctly.",
   "zen": "test"
 }
 ```
 
 **AI Review Summary:**
 ```markdown
 🤖 **Automated Code Review Summary**
 
 Found 4 item(s) to review:
 🔴 **1 Error(s)**
 🟡 **2 Warning(s)**
 💡 **1 Suggestion(s)**
 
 **Files Reviewed:**
 📄 **test.js** (4 issues)
    Lines: 1, 3-5
    🔴 1 error(s)   🟡 2 warning(s)   💡 1 suggestion(s)
 ```
 
 ---
 
 **💡 Tip**: Keep this reference handy while setting up and troubleshooting your AI code review agent!
