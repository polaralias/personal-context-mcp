import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
    resolveStatus: vi.fn(),
    setWorkStatus: vi.fn(),
    setLocation: vi.fn(),
    getLocationHistory: vi.fn(),
    upsertSchedule: vi.fn(),
    listSchedules: vi.fn(),
    deleteSchedule: vi.fn(),
    fetchHolidays: vi.fn(),
}));

vi.mock('../src/services/resolver', () => ({
    StatusResolver: {
        getInstance: () => ({
            resolveStatus: mocks.resolveStatus
        })
    }
}));

vi.mock('../src/services/tracker', () => ({
    TrackerService: {
        getInstance: () => ({
            setWorkStatus: mocks.setWorkStatus,
            setLocation: mocks.setLocation,
            getLocationHistory: mocks.getLocationHistory,
            upsertSchedule: mocks.upsertSchedule,
            listSchedules: mocks.listSchedules,
            deleteSchedule: mocks.deleteSchedule,
        })
    }
}));

vi.mock('../src/services/holiday', () => ({
    HolidayService: {
        getInstance: () => ({
            fetchHolidays: mocks.fetchHolidays,
            isBankHoliday: vi.fn().mockResolvedValue(false)
        })
    }
}));



// Import after mocks
import { mcpServer } from '../src/server/mcp';

describe('MCP Tools', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('status_get', () => {
        it('should return current status when no date provided', async () => {
            const mockStatus = {
                effectiveDate: '2026-01-17',
                resolvedAt: '2026-01-17T10:00:00Z',
                bankHoliday: false,
                weekend: false,
                workStatus: 'working',
                location: null,
                lastUpdated: '2026-01-17T09:00:00Z'
            };
            mocks.resolveStatus.mockResolvedValue(mockStatus);

            // Access the tool handler directly
            const tools = (mcpServer as any)._registeredTools;
            const statusGetTool = tools['status_get'];

            const result = await statusGetTool.handler({}, {});

            expect(result.content[0].type).toBe('text');
            expect(JSON.parse(result.content[0].text)).toEqual(mockStatus);
        });

        it('should return error for invalid date format', async () => {
            const tools = (mcpServer as any)._registeredTools;
            const statusGetTool = tools['status_get'];

            const result = await statusGetTool.handler({ date: 'not-a-date' }, {});

            expect(result.isError).toBe(true);
            expect(result.content[0].text).toContain('Invalid date format');
        });

        it('should return status for specific date', async () => {
            const mockStatus = {
                effectiveDate: '2026-01-20',
                workStatus: 'off',
                weekend: true,
            };
            mocks.resolveStatus.mockResolvedValue(mockStatus);

            const tools = (mcpServer as any)._registeredTools;
            const statusGetTool = tools['status_get'];

            await statusGetTool.handler({ date: '2026-01-20' }, {});

            expect(mocks.resolveStatus).toHaveBeenCalledWith(expect.any(Date));
        });
    });

    describe('status_set_override', () => {
        it('should set work status and return updated status', async () => {
            mocks.setWorkStatus.mockResolvedValue({ id: 1 });
            mocks.resolveStatus.mockResolvedValue({ workStatus: 'travel' });

            const tools = (mcpServer as any)._registeredTools;
            const tool = tools['status_set_override'];

            const result = await tool.handler({
                status: 'travel',
                reason: 'Business trip',
                ttlSeconds: 3600
            }, {});

            expect(mocks.setWorkStatus).toHaveBeenCalledWith('travel', 'Business trip', 3600);
            expect(JSON.parse(result.content[0].text).workStatus).toBe('travel');
        });
    });

    describe('status_set_location', () => {
        it('should set location with all parameters', async () => {
            mocks.setLocation.mockResolvedValue({ id: 1 });
            mocks.resolveStatus.mockResolvedValue({
                location: {
                    latitude: 51.5074,
                    longitude: -0.1278,
                    locationName: 'London',
                    source: 'manual'
                }
            });

            const tools = (mcpServer as any)._registeredTools;
            const tool = tools['status_set_location'];

            await tool.handler({
                latitude: 51.5074,
                longitude: -0.1278,
                locationName: 'London',
                source: 'manual',
                ttlSeconds: 7200
            }, {});

            expect(mocks.setLocation).toHaveBeenCalledWith(
                51.5074, -0.1278, 'London', 'manual', 7200
            );
        });
    });

    describe('status_schedule_set', () => {
        it('should reject invalid date format', async () => {
            const tools = (mcpServer as any)._registeredTools;
            const tool = tools['status_schedule_set'];

            const result = await tool.handler({ date: '17-01-2026' }, {});

            expect(result.isError).toBe(true);
            expect(result.content[0].text).toContain('Invalid date format');
        });

        it('should create schedule for valid date', async () => {
            mocks.upsertSchedule.mockResolvedValue({ date: '2026-01-20' });

            const tools = (mcpServer as any)._registeredTools;
            const tool = tools['status_schedule_set'];

            const result = await tool.handler({
                date: '2026-01-20',
                workStatus: 'off',
                reason: 'Holiday'
            }, {});

            expect(mocks.upsertSchedule).toHaveBeenCalledWith(
                '2026-01-20', 'off', undefined, 'Holiday'
            );
            expect(JSON.parse(result.content[0].text).success).toBe(true);
        });
    });

    describe('holidays_list', () => {
        it('should return holidays for default region', async () => {
            const mockHolidays = [
                { title: 'New Year', date: '2026-01-01' },
                { title: 'Easter Monday', date: '2026-04-06' }
            ];
            mocks.fetchHolidays.mockResolvedValue(mockHolidays);

            const tools = (mcpServer as any)._registeredTools;
            const tool = tools['holidays_list'];

            const result = await tool.handler({}, {});

            expect(mocks.fetchHolidays).toHaveBeenCalledWith(undefined);
            expect(JSON.parse(result.content[0].text)).toEqual(mockHolidays);
        });

        it('should pass region parameter', async () => {
            mocks.fetchHolidays.mockResolvedValue([]);

            const tools = (mcpServer as any)._registeredTools;
            const tool = tools['holidays_list'];

            await tool.handler({ region: 'scotland' }, {});

            expect(mocks.fetchHolidays).toHaveBeenCalledWith('scotland');
        });
    });
});
