import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import request from 'supertest';

// 1. Define mock BEFORE imports
// NOTE: We cannot refer to local variables inside vi.mock due to hoisting.
// We must return a new object or use a factory that doesn't reference outer scope directly
// unless we use `vi.hoisted`.

const mocks = vi.hoisted(() => {
  return {
    resolveStatus: vi.fn(),
  };
});

// 2. Mock the StatusResolver singleton
vi.mock('../src/services/resolver', () => {
  return {
    StatusResolver: {
      getInstance: () => ({
        resolveStatus: mocks.resolveStatus
      }),
    },
  };
});

// 5. Mock PrismaClient
vi.mock('@prisma/client', () => {
  return {
    PrismaClient: class {
      $queryRaw = vi.fn().mockResolvedValue([1]);
    },
  };
});

// 6. Import app AFTER mocks
import app from '../src/index';

describe('Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /healthz', () => {
    it('should return 200 OK', async () => {
      const res = await request(app).get('/healthz');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ok');
    });
  });
});
