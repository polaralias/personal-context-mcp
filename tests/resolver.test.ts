import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { StatusResolver } from '../src/services/resolver';
import db from '../src/db';
import { workStatusEvents, locationEvents, scheduledStatus } from '../src/db/schema';
import { HolidayService } from '../src/services/holiday';

// Mock HolidayService to avoid network calls
// We can mock the instance method 'isBankHoliday'
const mockIsBankHoliday = vi.fn();
vi.mock('../src/services/holiday', () => ({
    HolidayService: {
        getInstance: () => ({
            isBankHoliday: mockIsBankHoliday,
            fetchHolidays: vi.fn(),
        })
    }
}));

describe('StatusResolver', () => {
    let resolver: StatusResolver;

    beforeEach(() => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2023-10-02T12:00:00Z')); // Monday

        // Clear DB
        db.delete(workStatusEvents).run();
        db.delete(locationEvents).run();
        db.delete(scheduledStatus).run();

        resolver = StatusResolver.getInstance();
        mockIsBankHoliday.mockResolvedValue(false);
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.clearAllMocks();
    });

    it('should default to "off" if no events', async () => {
        const status = await resolver.resolveStatus();
        expect(status.workStatus).toBe('off');
    });

    it('should use latest valid permanent event', async () => {
        db.insert(workStatusEvents).values({
            source: 'manual',
            status: 'working',
            reason: '',
            createdAt: new Date()
        }).run();

        const status = await resolver.resolveStatus();
        expect(status.workStatus).toBe('working');
    });

    it('should use latest valid unexpired temporary event', async () => {
        db.insert(workStatusEvents).values({
            source: 'manual',
            status: 'travel',
            reason: '',
            createdAt: new Date(),
            expiresAt: new Date(Date.now() + 10000)
        }).run();

        const status = await resolver.resolveStatus();
        expect(status.workStatus).toBe('travel');
    });

    it('should ignore expired temporary events and fallback to previous valid event', async () => {
        // Previous event (working)
        db.insert(workStatusEvents).values({
            source: 'manual',
            status: 'working',
            createdAt: new Date(Date.now() - 20000)
        }).run();

        // Expired event (travel)
        db.insert(workStatusEvents).values({
            source: 'manual',
            status: 'travel',
            createdAt: new Date(Date.now() - 10000),
            expiresAt: new Date(Date.now() - 5000)
        }).run();

        const status = await resolver.resolveStatus();
        expect(status.workStatus).toBe('working');
    });

    it('should default to "off" on weekends', async () => {
        const date = new Date('2023-10-01T12:00:00Z'); // Sunday

        db.insert(workStatusEvents).values({
            source: 'manual',
            status: 'working',
            createdAt: new Date()
        }).run();

        const status = await resolver.resolveStatus(date);
        expect(status.weekend).toBe(true);
        expect(status.workStatus).toBe('off');
    });

    it('should respect scheduled overrides on weekends', async () => {
        const date = new Date('2023-10-01T12:00:00Z'); // Sunday
        const dateString = '2023-10-01';

        db.insert(workStatusEvents).values({
            source: 'manual',
            status: 'working',
            createdAt: new Date()
        }).run();

        db.insert(scheduledStatus).values({
            date: dateString,
            patch: { workStatus: 'working' },
            createdAt: new Date(),
            updatedAt: new Date()
        }).run();

        const status = await resolver.resolveStatus(date);
        expect(status.weekend).toBe(true);
        expect(status.workStatus).toBe('working');
    });

    it('should apply active TTL override for NOW even if scheduled is different', async () => {
        const date = new Date(); // NOW

        // Scheduled is working
        db.insert(scheduledStatus).values({
            date: date.toISOString().split('T')[0],
            patch: { workStatus: 'working' },
            createdAt: new Date(),
            updatedAt: new Date()
        }).run();

        // TTL Override (travel) - Created just now
        db.insert(workStatusEvents).values({
            source: 'manual',
            status: 'travel',
            createdAt: new Date(),
            expiresAt: new Date(Date.now() + 3600000)
        }).run();

        const status = await resolver.resolveStatus(date);
        expect(status.workStatus).toBe('travel');
    });
});
