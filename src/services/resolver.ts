import { PrismaClient } from '@prisma/client';
import prisma from '../db';
import { HolidayService } from './holiday';

// Types
export type WorkStatus = 'working' | 'off' | 'travel' | string;

export interface Location {
  latitude: number;
  longitude: number;
  locationName?: string;
  source: string;
  timestamp: string;
}

export interface Status {
  effectiveDate: string;   // YYYY-MM-DD
  resolvedAt: string;      // ISO timestamp
  bankHoliday: boolean;
  weekend: boolean;
  workStatus: WorkStatus;
  location: Location | null;
  lastUpdated: string;
}

export class StatusResolver {
  private static instance: StatusResolver;
  private prisma: PrismaClient;
  private holidayService: HolidayService;

  private constructor() {
    this.prisma = prisma;
    this.holidayService = HolidayService.getInstance();
  }

  public static getInstance(): StatusResolver {
    if (!StatusResolver.instance) {
      StatusResolver.instance = new StatusResolver();
    }
    return StatusResolver.instance;
  }

  async resolveStatus(date: Date = new Date()): Promise<Status> {
    const dateString = date.toISOString().split('T')[0]; // YYYY-MM-DD
    const resolvedAt = new Date().toISOString();
    const now = new Date();
    const locationStaleHours = Number(process.env.LOCATION_STALE_HOURS ?? 6);
    const locationStaleMs = Number.isFinite(locationStaleHours) && locationStaleHours > 0
      ? locationStaleHours * 60 * 60 * 1000
      : 6 * 60 * 60 * 1000;

    // 1. Determine Temporal State
    const dayOfWeek = date.getDay(); // 0 = Sunday, 6 = Saturday
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    const isBankHoliday = await this.holidayService.isBankHoliday(date);

    // 2. Fetch Base Status (Latest VALID event for target date)
    // For resolver tests, we use 'date' to ensure finding what was valid AT THAT TIME.
    const baseWorkEvent = await this.findLatestValidWorkEvent(date);

    const latestLocationEvent = await this.prisma.locationEvent.findFirst({
      orderBy: { createdAt: 'desc' },
    });

    // 3. Start with Base Status
    let workStatus: WorkStatus = baseWorkEvent?.status || 'off';

    // 4. Force 'off' on weekends/holidays UNLESS explicitly Resolving for today with a TTL override
    // or overridden by a schedule.
    if (isWeekend || isBankHoliday) {
      workStatus = 'off';
    }

    // 5. Check for Scheduled Overrides (Exact Date)
    const scheduled = await this.prisma.scheduledStatus.findUnique({
      where: { date: dateString }
    });

    if (scheduled && scheduled.patch) {
      const patch = scheduled.patch as any;
      if (patch.workStatus) {
        workStatus = patch.workStatus;
      }
    }

    // 6. Check for "Now" Overrides (TTL) - ONLY if resolving for TODAY
    const isToday = dateString === now.toISOString().split('T')[0];
    if (isToday) {
      const latestEvent = await this.prisma.workStatusEvent.findFirst({
        orderBy: { createdAt: 'desc' }
      });

      if (latestEvent && latestEvent.expiresAt && latestEvent.expiresAt > now) {
        workStatus = latestEvent.status;
      }
    }

    // Resolve Location
    let location: Location | null = null;
    if (latestLocationEvent) {
      const isExpired = latestLocationEvent.expiresAt
        ? latestLocationEvent.expiresAt < now
        : false;
      const isStale = now.getTime() - latestLocationEvent.createdAt.getTime() > locationStaleMs;
      if (isExpired || isStale) {
        location = null;
      } else {
        location = {
          latitude: latestLocationEvent.latitude,
          longitude: latestLocationEvent.longitude,
          locationName: latestLocationEvent.name || undefined,
          source: latestLocationEvent.source,
          timestamp: latestLocationEvent.createdAt.toISOString()
        };
      }
    }

    return {
      effectiveDate: dateString,
      resolvedAt,
      bankHoliday: isBankHoliday,
      weekend: isWeekend,
      workStatus,
      location,
      lastUpdated: baseWorkEvent?.createdAt.toISOString() || resolvedAt // Fallback
    } as Status;
  }

  // Find the latest event that is either permanent (no expiresAt) OR not yet expired at target date.
  private async findLatestValidWorkEvent(targetDate: Date) {
    // To satisfy tests that mock NOW, we use gt: targetDate
    return this.prisma.workStatusEvent.findFirst({
      where: {
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: targetDate } }
        ]
      },
      orderBy: { createdAt: 'desc' }
    });
  }
}
