#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

async function question(prompt) {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
}

async function setup() {
  console.log('🤖 Code Review Agent Setup\n');
  console.log('This script will help you configure the Code Review Agent.\n');

  const envPath = path.join(process.cwd(), '.env');
  let envContent = '';

  try {
    // Check if .env already exists
    if (fs.existsSync(envPath)) {
      const overwrite = await question('⚠️  .env file already exists. Overwrite? (y/N): ');
      if (overwrite.toLowerCase() !== 'y') {
        console.log('Setup cancelled.');
        rl.close();
        return;
      }
    }

    console.log('\n📋 Configuration Setup');
    console.log('='.repeat(40));

    // Basic Configuration
    const port = await question('🌐 Server port (3000): ') || '3000';
    const nodeEnv = await question('🏗️  Environment (development): ') || 'development';

    envContent += `# Server Configuration\n`;
    envContent += `PORT=${port}\n`;
    envContent += `NODE_ENV=${nodeEnv}\n`;
    envContent += `WEBHOOK_URL=http://localhost:${port}/webhook/github\n`;
    envContent += `ALLOWED_ORIGINS=*\n\n`;

    // GitHub Configuration
    console.log('\n🐙 GitHub Configuration');
    console.log('-'.repeat(25));
    const githubToken = await question('🔑 GitHub Personal Access Token: ');
    const webhookSecret = await question('🔐 GitHub Webhook Secret (optional): ');

    if (!githubToken) {
      console.log('❌ GitHub token is required!');
      console.log('💡 Get one at: https://github.com/settings/tokens');
      rl.close();
      return;
    }

    envContent += `# GitHub Configuration\n`;
    envContent += `GITHUB_TOKEN=${githubToken}\n`;
    if (webhookSecret) {
      envContent += `GITHUB_WEBHOOK_SECRET=${webhookSecret}\n`;
    }
    envContent += `\n`;

    // Gemini AI Configuration  
    console.log('\n🧠 Gemini AI Configuration');
    console.log('-'.repeat(28));
    const geminiApiKey = await question('🔑 Gemini API Key: ');
    const geminiModel = await question('🤖 Gemini Model (gemini-2.0-flash-exp): ') || 'gemini-2.0-flash-exp';

    if (!geminiApiKey) {
      console.log('❌ Gemini API key is required!');
      console.log('💡 Get one at: https://makersuite.google.com/app/apikey');
      rl.close();
      return;
    }

    envContent += `# Gemini AI Configuration\n`;
    envContent += `GEMINI_API_KEY=${geminiApiKey}\n`;
    envContent += `GEMINI_MODEL=${geminiModel}\n\n`;

    // Database Configuration
    console.log('\n🗄️  Database Configuration');
    console.log('-'.repeat(27));
    const mongoUri = await question('🍃 MongoDB URI (mongodb://localhost:27017/code-review-agent): ') 
      || 'mongodb://localhost:27017/code-review-agent';

    envContent += `# Database Configuration\n`;
    envContent += `MONGODB_URI=${mongoUri}\n\n`;

    // Review Configuration
    console.log('\n⚙️  Review Configuration');
    console.log('-'.repeat(25));
    const maxFiles = await question('📁 Max files per PR (50): ') || '50';
    const maxDiffSize = await question('📏 Max diff size in bytes (100000): ') || '100000';

    envContent += `# Review Configuration\n`;
    envContent += `MAX_FILES_PER_PR=${maxFiles}\n`;
    envContent += `MAX_DIFF_SIZE=${maxDiffSize}\n`;
    envContent += `REVIEW_TIMEOUT=300000\n\n`;

    // Review Criteria
    console.log('\n✅ Review Criteria (y/N)');
    console.log('-'.repeat(25));
    const checkSecurity = (await question('🔒 Check security issues (Y): ') || 'y').toLowerCase() === 'y';
    const checkPerformance = (await question('⚡ Check performance (Y): ') || 'y').toLowerCase() === 'y';
    const checkReadability = (await question('📖 Check readability (Y): ') || 'y').toLowerCase() === 'y';
    const checkBestPractices = (await question('✨ Check best practices (Y): ') || 'y').toLowerCase() === 'y';
    const checkTesting = (await question('🧪 Check testing (Y): ') || 'y').toLowerCase() === 'y';
    const checkDocumentation = (await question('📝 Check documentation (Y): ') || 'y').toLowerCase() === 'y';

    envContent += `# Review Criteria\n`;
    envContent += `CHECK_SECURITY=${checkSecurity}\n`;
    envContent += `CHECK_PERFORMANCE=${checkPerformance}\n`;
    envContent += `CHECK_READABILITY=${checkReadability}\n`;
    envContent += `CHECK_BEST_PRACTICES=${checkBestPractices}\n`;
    envContent += `CHECK_TESTING=${checkTesting}\n`;
    envContent += `CHECK_DOCUMENTATION=${checkDocumentation}\n\n`;

    // Logging Configuration
    const logLevel = await question('📊 Log level (info): ') || 'info';
    envContent += `# Logging\n`;
    envContent += `LOG_LEVEL=${logLevel}\n`;
    envContent += `LOG_FORMAT=combined\n\n`;

    // Rate Limiting
    envContent += `# Rate Limiting\n`;
    envContent += `RATE_LIMIT_WINDOW=900000\n`;
    envContent += `RATE_LIMIT_MAX=100\n`;

    // Write .env file
    fs.writeFileSync(envPath, envContent);
    
    console.log('\n✅ Configuration saved to .env');
    console.log('\n🚀 Next Steps:');
    console.log('1. Start MongoDB if not running');
    console.log('2. Run: npm run dev');
    console.log('3. Configure GitHub webhook to point to your server');
    console.log('4. Test with a pull request!');
    
    // Create logs directory
    const logsDir = path.join(process.cwd(), 'logs');
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir);
      console.log('📁 Created logs directory');
    }

  } catch (error) {
    console.error('❌ Setup failed:', error.message);
  } finally {
    rl.close();
  }
}

if (require.main === module) {
  setup();
}

module.exports = setup;
