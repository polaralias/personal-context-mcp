import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
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
    const connectionString = `${process.env.DATABASE_URL}`;
    const pool = new Pool({ connectionString });
    const adapter = new PrismaPg(pool);
    this.prisma = new PrismaClient({ adapter });
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

    // 1. Determine Temporal State
    const dayOfWeek = date.getDay(); // 0 = Sunday, 6 = Saturday
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    const isBankHoliday = await this.holidayService.isBankHoliday(date);

    // 2. Fetch Base Status (Latest events)
    const latestWorkEvent = await this.prisma.workStatusEvent.findFirst({
      orderBy: { createdAt: 'desc' },
    });

    const latestLocationEvent = await this.prisma.locationEvent.findFirst({
      orderBy: { createdAt: 'desc' },
    });

    // 3. Apply Defaults
    let workStatus: WorkStatus = latestWorkEvent?.status || 'off';

    if (isWeekend || isBankHoliday) {
      workStatus = 'off';
    } else {
        workStatus = latestWorkEvent?.status || 'off';
    }

    // 4. Check for Scheduled Overrides (Exact Date)
    const scheduled = await this.prisma.scheduledStatus.findUnique({
      where: { date: dateString }
    });

    if (scheduled && scheduled.patch) {
        const patch = scheduled.patch as any;
        if (patch.workStatus) {
            workStatus = patch.workStatus;
        }
    }

    // 5. Check for "Now" Overrides (TTL) - ONLY if resolving for TODAY
    const isToday = dateString === new Date().toISOString().split('T')[0];

    if (isToday) {
         if (latestWorkEvent && latestWorkEvent.expiresAt && latestWorkEvent.expiresAt > new Date()) {
             workStatus = latestWorkEvent.status;
         }
    }

    // Resolve Location
    let location: Location | null = null;
    if (latestLocationEvent) {
        location = {
            latitude: latestLocationEvent.latitude,
            longitude: latestLocationEvent.longitude,
            locationName: latestLocationEvent.name || undefined,
            source: latestLocationEvent.source,
            timestamp: latestLocationEvent.createdAt.toISOString()
        };
    }

    return {
      effectiveDate: dateString,
      resolvedAt,
      bankHoliday: isBankHoliday,
      weekend: isWeekend,
      workStatus,
      location,
      lastUpdated: latestWorkEvent?.createdAt.toISOString() || resolvedAt // Fallback
    } as Status;
  }
}
