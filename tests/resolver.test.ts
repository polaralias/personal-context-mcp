import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mocks
const mocks = vi.hoisted(() => {
  return {
    prisma: {
      workStatusEvent: {
        findMany: vi.fn(),
        findFirst: vi.fn(),
      },
      locationEvent: {
        findFirst: vi.fn(),
      },
      scheduledStatus: {
        findUnique: vi.fn(),
      },
      bankHolidayCache: {
        findUnique: vi.fn(),
        upsert: vi.fn(),
      }
    },
    holidayService: {
        isBankHoliday: vi.fn(),
        fetchHolidays: vi.fn(),
        getInstance: vi.fn(),
    }
  };
});

// Mock dependencies
vi.mock('../src/db', () => ({ default: mocks.prisma }));
vi.mock('../src/services/holiday', () => ({
    HolidayService: {
        getInstance: () => mocks.holidayService
    }
}));

import { StatusResolver } from '../src/services/resolver';

describe('StatusResolver', () => {
    let resolver: StatusResolver;

    beforeEach(() => {
        vi.clearAllMocks();
        resolver = StatusResolver.getInstance();
        mocks.holidayService.isBankHoliday.mockResolvedValue(false);
    });

    it('should default to "off" if no events', async () => {
        mocks.prisma.workStatusEvent.findFirst.mockResolvedValue(null);
        mocks.prisma.locationEvent.findFirst.mockResolvedValue(null);
        mocks.prisma.scheduledStatus.findUnique.mockResolvedValue(null);

        const status = await resolver.resolveStatus();
        expect(status.workStatus).toBe('off');
    });

    it('should use latest valid permanent event', async () => {
        mocks.prisma.workStatusEvent.findFirst.mockResolvedValue(
            { status: 'working', createdAt: new Date(), expiresAt: null }
        );

        const status = await resolver.resolveStatus();
        expect(status.workStatus).toBe('working');
    });

    it('should use latest valid unexpired temporary event', async () => {
         mocks.prisma.workStatusEvent.findFirst.mockResolvedValue(
            { status: 'travel', createdAt: new Date(), expiresAt: new Date(Date.now() + 10000) }
        );

        const status = await resolver.resolveStatus();
        expect(status.workStatus).toBe('travel');
    });

    // This test now relies on the implementation correctly calling prisma.findFirst with OR condition
    it('should ignore expired temporary events and fallback to previous valid event', async () => {
        // The implementation asks Prisma for the latest VALID event.
        // So we just mock the return of that specific query to be the "previous valid" one.
        // To verify the "pagination cliff" logic, we rely on the fact that we are mocking findFirst
        // and expecting it to be called, rather than findMany.

        mocks.prisma.workStatusEvent.findFirst.mockResolvedValue(
            { status: 'working', createdAt: new Date(Date.now() - 20000), expiresAt: null }
        );

        const status = await resolver.resolveStatus();
        expect(status.workStatus).toBe('working');

        // Ensure findFirst was called (and not findMany which was the bug)
        expect(mocks.prisma.workStatusEvent.findFirst).toHaveBeenCalled();
    });

    it('should default to "off" on weekends', async () => {
        // Mock a Sunday
        const date = new Date('2023-10-01T12:00:00Z'); // Sunday

        mocks.prisma.workStatusEvent.findFirst.mockResolvedValue(
            { status: 'working', createdAt: new Date(), expiresAt: null }
        );

        const status = await resolver.resolveStatus(date);
        expect(status.weekend).toBe(true);
        expect(status.workStatus).toBe('off');
    });

    it('should respect scheduled overrides on weekends', async () => {
         const date = new Date('2023-10-01T12:00:00Z'); // Sunday
         const dateString = '2023-10-01';

         mocks.prisma.workStatusEvent.findFirst.mockResolvedValue(
            { status: 'working', createdAt: new Date(), expiresAt: null }
        );

        mocks.prisma.scheduledStatus.findUnique.mockResolvedValue({
            date: dateString,
            patch: { workStatus: 'working' }
        });

        const status = await resolver.resolveStatus(date);
        expect(status.weekend).toBe(true);
        expect(status.workStatus).toBe('working');
    });

    it('should apply active TTL override for NOW even if scheduled is different', async () => {
         const date = new Date(); // NOW

         // Base is off - mocked by the "Valid Base" query
         mocks.prisma.workStatusEvent.findFirst.mockImplementation((args) => {
             // Differentiate the two calls to findFirst
             // 1. findLatestValidWorkEvent calls findFirst with a 'where' clause
             if (args && args.where) {
                 return Promise.resolve({ status: 'off', createdAt: new Date(), expiresAt: null });
             }
             // 2. The "TTL override" check calls findFirst without 'where' (just orderBy)
             return Promise.resolve({
                 status: 'travel',
                 createdAt: new Date(),
                 expiresAt: new Date(Date.now() + 3600000)
            });
         });

         // Scheduled is working
         mocks.prisma.scheduledStatus.findUnique.mockResolvedValue({
            date: date.toISOString().split('T')[0],
            patch: { workStatus: 'working' }
        });

        const status = await resolver.resolveStatus(date);
        expect(status.workStatus).toBe('travel');
    });
});
