import db from '../db';
import { bankHolidayCache } from '../db/schema';
import { and, eq } from 'drizzle-orm';

const GOV_UK_HOLIDAYS_URL = 'https://www.gov.uk/bank-holidays.json';

interface HolidayEvent {
  title: string;
  date: string;
  notes: string;
  bunting: boolean;
}

interface HolidayRegion {
  division: string;
  events: HolidayEvent[];
}

interface HolidayResponse {
  [key: string]: HolidayRegion;
}

export class HolidayService {
  private static instance: HolidayService;

  private constructor() {
  }

  public static getInstance(): HolidayService {
    if (!HolidayService.instance) {
      HolidayService.instance = new HolidayService();
    }
    return HolidayService.instance;
  }

  async fetchHolidays(region = 'england-and-wales'): Promise<HolidayEvent[]> {
    const currentYear = new Date().getFullYear();

    // Check cache first
    const cached = db.select()
      .from(bankHolidayCache)
      .where(and(
        eq(bankHolidayCache.region, region),
        eq(bankHolidayCache.year, currentYear)
      ))
      .get();

    // Refresh if cache is older than 24 hours or doesn't exist
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    if (cached && cached.fetchedAt > oneDayAgo) {
      return cached.payload as unknown as HolidayEvent[];
    }

    try {
      const response = await fetch(GOV_UK_HOLIDAYS_URL);
      if (!response.ok) {
        throw new Error(`Failed to fetch holidays: ${response.statusText}`);
      }

      const data = await response.json() as HolidayResponse;

      if (!data[region]) {
        throw new Error(`Region ${region} not found in holiday data`);
      }

      const events = data[region].events;

      // Update cache
      const now = new Date();
      db.insert(bankHolidayCache)
        .values({
          region,
          year: currentYear,
          payload: events as unknown[],
          fetchedAt: now
        })
        .onConflictDoUpdate({
          target: [bankHolidayCache.region, bankHolidayCache.year],
          set: { payload: events as unknown[], fetchedAt: now }
        })
        .run();

      return events;
    } catch (error) {
      console.error('Error fetching holidays:', error);
      // Return cached data if available (even if stale) as fallback
      if (cached) {
        return cached.payload as unknown as HolidayEvent[];
      }
      throw error;
    }
  }

  async isBankHoliday(date: Date, region = 'england-and-wales'): Promise<boolean> {
    try {
      const holidays = await this.fetchHolidays(region);
      const dateString = date.toISOString().split('T')[0];
      return holidays.some(h => h.date === dateString);
    } catch (error) {
      console.error('Error checking bank holiday:', error);
      return false; // Fail safe
    }
  }
}
