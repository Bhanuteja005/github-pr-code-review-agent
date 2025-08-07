const request = require('supertest');
const app = require('../src/index');

describe('Code Review Agent API', () => {
  describe('GET /health', () => {
    it('should return health status', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.body).toHaveProperty('status', 'healthy');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('version');
    });
  });

  describe('POST /webhook/github', () => {
    it('should handle ping events', async () => {
      const pingPayload = {
        zen: 'Keep it logically awesome.',
        hook_id: 12345,
        repository: {
          full_name: 'test/repo'
        }
      };

      const response = await request(app)
        .post('/webhook/github')
        .set('X-GitHub-Event', 'ping')
        .set('X-GitHub-Delivery', 'test-delivery-id')
        .send(pingPayload)
        .expect(200);

      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toContain('Pong');
    });

    it('should reject requests without GitHub headers', async () => {
      await request(app)
        .post('/webhook/github')
        .send({})
        .expect(400);
    });
  });

  describe('GET /api/reviews/:prId', () => {
    it('should require owner and repo parameters', async () => {
      await request(app)
        .get('/api/reviews/123')
        .expect(400);
    });

    it('should return 404 for non-existent review', async () => {
      await request(app)
        .get('/api/reviews/999')
        .query({ owner: 'test', repo: 'repo' })
        .expect(404);
    });
  });

  describe('Error handling', () => {
    it('should handle 404 routes', async () => {
      await request(app)
        .get('/non-existent-route')
        .expect(404);
    });
  });
});
