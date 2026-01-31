import db from '../db';
import { locationEvents, scheduledStatus, workStatusEvents } from '../db/schema';
import { desc, eq, gt, isNull, or } from 'drizzle-orm';
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
  private holidayService: HolidayService;

  private constructor() {
    this.holidayService = HolidayService.getInstance();
  }

  public static getInstance(): StatusResolver {
    if (!StatusResolver.instance) {
      StatusResolver.instance = new StatusResolver();
    }
    return StatusResolver.instance;
  }

  async resolveStatus(date: Date = new Date()): Promise<Status> {
    const isoDate = date.toISOString();
    const dateString = isoDate.split('T')[0] ?? isoDate.slice(0, 10); // YYYY-MM-DD
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

    const latestLocationEvent = db.select()
      .from(locationEvents)
      .orderBy(desc(locationEvents.createdAt))
      .get();

    // 3. Start with Base Status
    let workStatus: WorkStatus = baseWorkEvent?.status || 'off';

    // 4. Force 'off' on weekends/holidays UNLESS explicitly Resolving for today with a TTL override
    // or overridden by a schedule.
    if (isWeekend || isBankHoliday) {
      workStatus = 'off';
    }

    // 5. Check for Scheduled Overrides (Exact Date)
    const scheduled = db.select()
      .from(scheduledStatus)
      .where(eq(scheduledStatus.date, dateString))
      .get();

    if (scheduled && scheduled.patch) {
      const patch = scheduled.patch as any;
      if (patch.workStatus) {
        workStatus = patch.workStatus;
      }
    }

    // 6. Check for "Now" Overrides (TTL) - ONLY if resolving for TODAY
    const nowIsoDate = now.toISOString();
    const todayString = nowIsoDate.split('T')[0] ?? nowIsoDate.slice(0, 10);
    const isToday = dateString === todayString;
    if (isToday) {
      const latestEvent = db.select()
        .from(workStatusEvents)
        .orderBy(desc(workStatusEvents.createdAt))
        .get();

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
    return db.select()
      .from(workStatusEvents)
      .where(or(
        isNull(workStatusEvents.expiresAt),
        gt(workStatusEvents.expiresAt, targetDate)
      ))
      .orderBy(desc(workStatusEvents.createdAt))
      .get();
  }
}
