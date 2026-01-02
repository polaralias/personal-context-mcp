import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';

// Mocks
const mockHandleRequest = vi.fn((req, res) => {
    res.status(200).send('ok');
});
const mockConnect = vi.fn();

// Mock dependencies
vi.mock('../src/services/resolver', () => ({
  StatusResolver: { getInstance: () => ({ resolveStatus: vi.fn() }) }
}));
vi.mock('../src/services/holiday', () => ({
  HolidayService: { getInstance: () => ({ fetchHolidays: vi.fn() }) }
}));
vi.mock('../src/services/tracker', () => ({
  TrackerService: { getInstance: () => ({}) }
}));
// Mock logger to avoid clutter
vi.mock('../src/logger', () => ({
    createLogger: () => ({
        info: vi.fn(),
        debug: vi.fn(),
        error: vi.fn(),
        warn: vi.fn(),
    }),
    getRequestId: () => 'test-req-id'
}));

// Mock SDK
vi.mock('@modelcontextprotocol/sdk/server/mcp.js', () => ({
  McpServer: class {
    constructor() {}
    tool() {}
    connect(t: any) { return mockConnect(t); }
  }
}));

const mockTransportInstances: any[] = [];
vi.mock('@modelcontextprotocol/sdk/server/streamableHttp.js', () => {
  return {
    StreamableHTTPServerTransport: class {
      constructor() {
        mockTransportInstances.push(this);
      }
      handleRequest(req: any, res: any) { return mockHandleRequest(req, res); }
    }
  };
});

// Import the handler under test
import { handleMcpRequest, getMcpContext } from '../src/server/mcp';

// Setup Express app
const app = express();
app.use(express.json());
// Mock auth middleware that injects config
app.all('/mcp', (req: any, res: any, next: any) => {
    req.mcpConfig = { testKey: 'testValue' };
    next();
}, handleMcpRequest);

describe('MCP Session Management', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockTransportInstances.length = 0;
        // We cannot easily clear the sessionMap in mcp.ts as it is not exported.
        // We will rely on using unique session IDs for each test case or managing state carefully.
    });

    it('should create a new transport for a request without session id', async () => {
        await request(app).post('/mcp').send({});
        expect(mockTransportInstances.length).toBe(1);
        expect(mockConnect).toHaveBeenCalledTimes(1);
    });

    it('should reuse transport for existing session', async () => {
        // 1. Trigger first request to create transport
        await request(app).post('/mcp').send({});
        expect(mockTransportInstances.length).toBeGreaterThan(0);
        const transport = mockTransportInstances[mockTransportInstances.length - 1];

        // 2. Simulate session initialization
        const sessionId = 'session-' + Date.now();
        if (transport.onsessioninitialized) {
            transport.onsessioninitialized(sessionId);
        } else {
            throw new Error('onsessioninitialized not set on transport');
        }

        // 3. Clear mock counts to verify next call
        mockConnect.mockClear();
        const initialInstancesCount = mockTransportInstances.length;

        // 4. Make second request WITH session id
        await request(app)
            .post('/mcp')
            .set('mcp-session-id', sessionId)
            .send({});

        // 5. Verify reuse
        expect(mockTransportInstances.length).toBe(initialInstancesCount); // No new instance
        expect(mockConnect).not.toHaveBeenCalled(); // Connect not called again
    });

    it('should normalize Accept header', async () => {
        await request(app)
            .post('/mcp')
            .set('Accept', '*/*')
            .send({});

        // Check the request object passed to handleRequest
        const reqPassed = mockHandleRequest.mock.calls[mockHandleRequest.mock.calls.length - 1][0];
        expect(reqPassed.headers.accept).toContain('application/json');
    });

    it('should provide context via AsyncLocalStorage', async () => {
         // This is tricky to test because AsyncLocalStorage works within the scope.
         // We need to spy on something called INSIDE the scope.
         // transport.handleRequest is called inside the scope.

         mockHandleRequest.mockImplementationOnce((req, res) => {
             const ctx = getMcpContext();
             expect(ctx).toEqual({ testKey: 'testValue' });
             res.status(200).send('ok');
         });

         await request(app).post('/mcp').send({});
         expect(mockHandleRequest).toHaveBeenCalled();
    });
});
