#!/usr/bin/env node

/**
 * Test script for GitHub webhook events
 * Simulates GitHub webhook payloads for testing
 */

const crypto = require('crypto');
const axios = require('axios');

const WEBHOOK_URL = process.env.WEBHOOK_URL || 'http://localhost:3000/webhook/github';
const WEBHOOK_SECRET = process.env.GITHUB_WEBHOOK_SECRET || 'test-secret';

/**
 * Generate GitHub webhook signature
 */
function generateSignature(payload, secret) {
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(payload, 'utf8');
  return `sha256=${hmac.digest('hex')}`;
}

/**
 * Send webhook event
 */
async function sendWebhook(event, payload) {
  const payloadString = JSON.stringify(payload);
  const signature = generateSignature(payloadString, WEBHOOK_SECRET);
  
  try {
    const response = await axios.post(WEBHOOK_URL, payloadString, {
      headers: {
        'Content-Type': 'application/json',
        'X-GitHub-Event': event,
        'X-GitHub-Delivery': `test-${Date.now()}`,
        'X-Hub-Signature-256': signature,
        'User-Agent': 'GitHub-Hookshot/test'
      }
    });
    
    console.log(`✅ ${event} event sent successfully`);
    console.log(`Response: ${response.status} - ${JSON.stringify(response.data)}`);
    return response.data;
  } catch (error) {
    console.error(`❌ Failed to send ${event} event:`, error.message);
    if (error.response) {
      console.error(`Response: ${error.response.status} - ${JSON.stringify(error.response.data)}`);
    }
    throw error;
  }
}

/**
 * Test payloads
 */
const payloads = {
  ping: {
    zen: 'Keep it logically awesome.',
    hook_id: 12345,
    hook: {
      type: 'Repository',
      id: 12345,
      name: 'web',
      active: true,
      events: ['push', 'pull_request'],
      config: {
        content_type: 'json',
        insecure_ssl: '0',
        url: WEBHOOK_URL
      }
    },
    repository: {
      id: 123456,
      name: 'test-repo',
      full_name: 'testuser/test-repo',
      owner: {
        login: 'testuser',
        id: 12345,
        type: 'User'
      },
      private: false,
      html_url: 'https://github.com/testuser/test-repo',
      description: 'A test repository',
      fork: false,
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z'
    }
  },

  pullRequest: {
    action: 'opened',
    number: 123,
    pull_request: {
      id: 123456,
      number: 123,
      state: 'open',
      title: 'Add new feature for testing',
      user: {
        login: 'developer',
        id: 67890,
        type: 'User'
      },
      body: 'This PR adds a new feature for testing the code review agent.\n\nChanges:\n- Added new utility function\n- Updated tests\n- Fixed documentation',
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
      closed_at: null,
      merged_at: null,
      merge_commit_sha: null,
      assignee: null,
      assignees: [],
      requested_reviewers: [],
      requested_teams: [],
      head: {
        label: 'testuser:feature-branch',
        ref: 'feature-branch',
        sha: 'abc123def456',
        user: {
          login: 'testuser',
          id: 12345,
          type: 'User'
        },
        repo: {
          id: 123456,
          name: 'test-repo',
          full_name: 'testuser/test-repo'
        }
      },
      base: {
        label: 'testuser:main',
        ref: 'main',
        sha: 'def456abc123',
        user: {
          login: 'testuser',
          id: 12345,
          type: 'User'
        },
        repo: {
          id: 123456,
          name: 'test-repo',
          full_name: 'testuser/test-repo'
        }
      },
      draft: false,
      commits: 3,
      additions: 45,
      deletions: 12,
      changed_files: 5
    },
    repository: {
      id: 123456,
      name: 'test-repo',
      full_name: 'testuser/test-repo',
      owner: {
        login: 'testuser',
        id: 12345,
        type: 'User'
      },
      private: false,
      html_url: 'https://github.com/testuser/test-repo'
    },
    sender: {
      login: 'developer',
      id: 67890,
      type: 'User'
    }
  },

  pullRequestSynchronize: {
    action: 'synchronize',
    number: 123,
    before: 'abc123def456',
    after: 'def456abc789',
    pull_request: {
      id: 123456,
      number: 123,
      state: 'open',
      title: 'Add new feature for testing',
      user: {
        login: 'developer',
        id: 67890,
        type: 'User'
      },
      body: 'Updated PR with additional changes.',
      head: {
        ref: 'feature-branch',
        sha: 'def456abc789'
      },
      base: {
        ref: 'main',
        sha: 'def456abc123'
      }
    },
    repository: {
      id: 123456,
      name: 'test-repo',
      full_name: 'testuser/test-repo',
      owner: {
        login: 'testuser',
        id: 12345,
        type: 'User'
      }
    }
  }
};

/**
 * Run tests
 */
async function runTests() {
  console.log('🧪 Testing GitHub Webhook Events');
  console.log(`📡 Webhook URL: ${WEBHOOK_URL}`);
  console.log('='.repeat(50));

  try {
    // Test 1: Ping event
    console.log('\n1. Testing ping event...');
    await sendWebhook('ping', payloads.ping);
    await sleep(1000);

    // Test 2: Pull request opened
    console.log('\n2. Testing pull_request opened event...');
    await sendWebhook('pull_request', payloads.pullRequest);
    await sleep(2000);

    // Test 3: Pull request synchronize
    console.log('\n3. Testing pull_request synchronize event...');
    await sendWebhook('pull_request', payloads.pullRequestSynchronize);
    await sleep(1000);

    console.log('\n✅ All tests completed successfully!');
    
    // Wait a bit and check review status
    console.log('\n⏳ Waiting 5 seconds to check review status...');
    await sleep(5000);
    
    try {
      const statusResponse = await axios.get(`${WEBHOOK_URL.replace('/webhook/github', '')}/api/reviews/123`, {
        params: { owner: 'testuser', repo: 'test-repo' }
      });
      console.log('📊 Review Status:', JSON.stringify(statusResponse.data, null, 2));
    } catch (error) {
      console.log('ℹ️  Review status not available yet (expected for new setup)');
    }

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    process.exit(1);
  }
}

/**
 * Sleep helper
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Main execution
 */
if (require.main === module) {
  const command = process.argv[2];
  
  switch (command) {
    case 'ping':
      sendWebhook('ping', payloads.ping);
      break;
    case 'pr':
      sendWebhook('pull_request', payloads.pullRequest);
      break;
    case 'sync':
      sendWebhook('pull_request', payloads.pullRequestSynchronize);
      break;
    case 'all':
    default:
      runTests();
      break;
  }
}

module.exports = {
  sendWebhook,
  payloads,
  generateSignature
};
