// Test setup file
beforeAll(async () => {
  // Set test environment variables
  process.env.NODE_ENV = 'test';
  process.env.GITHUB_TOKEN = 'test-token';
  process.env.GEMINI_API_KEY = 'test-key';
  process.env.MONGODB_URI = 'mongodb://localhost:27017/code-review-agent-test';
});

afterAll(async () => {
  // Cleanup after tests
  if (global.__MONGOD__) {
    await global.__MONGOD__.stop();
  }
});
