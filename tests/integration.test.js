"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const supertest_1 = __importDefault(require("supertest"));
// 1. Define mock BEFORE imports
// NOTE: We cannot refer to local variables inside vi.mock due to hoisting.
// We must return a new object or use a factory that doesn't reference outer scope directly
// unless we use `vi.hoisted`.
const mocks = vitest_1.vi.hoisted(() => {
    return {
        resolveStatus: vitest_1.vi.fn(),
    };
});
// 2. Mock the StatusResolver singleton
vitest_1.vi.mock('../src/services/resolver', () => {
    return {
        StatusResolver: {
            getInstance: () => ({
                resolveStatus: mocks.resolveStatus
            }),
        },
    };
});
// 3. Mock pg
vitest_1.vi.mock('pg', () => {
    return {
        Pool: class {
            connect() { }
            query() { }
            end() { }
        },
    };
});
// 4. Mock PrismaAdapter
vitest_1.vi.mock('@prisma/adapter-pg', () => {
    return {
        PrismaPg: class {
        },
    };
});
// 5. Mock PrismaClient
vitest_1.vi.mock('@prisma/client', () => {
    return {
        PrismaClient: class {
        },
    };
});
// 6. Import app AFTER mocks
const index_1 = __importDefault(require("../src/index"));
(0, vitest_1.describe)('Integration Tests', () => {
    (0, vitest_1.beforeEach)(() => {
        vitest_1.vi.clearAllMocks();
    });
    (0, vitest_1.describe)('GET /status', () => {
        (0, vitest_1.it)('should return 200 and status', async () => {
            mocks.resolveStatus.mockResolvedValue({
                effectiveDate: '2025-01-01',
                workStatus: 'working',
            });
            const res = await (0, supertest_1.default)(index_1.default).get('/status');
            (0, vitest_1.expect)(res.status).toBe(200);
            (0, vitest_1.expect)(res.body.workStatus).toBe('working');
        });
        (0, vitest_1.it)('should handle errors gracefully', async () => {
            mocks.resolveStatus.mockRejectedValue(new Error('Boom'));
            const res = await (0, supertest_1.default)(index_1.default).get('/status');
            (0, vitest_1.expect)(res.status).toBe(500);
        });
    });
    (0, vitest_1.describe)('GET /healthz', () => {
        (0, vitest_1.it)('should return 200 OK', async () => {
            const res = await (0, supertest_1.default)(index_1.default).get('/healthz');
            (0, vitest_1.expect)(res.status).toBe(200);
            (0, vitest_1.expect)(res.body.status).toBe('ok');
        });
    });
});
//# sourceMappingURL=integration.test.js.map