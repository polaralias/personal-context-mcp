import db from '../db';
import { locationEvents, scheduledStatus, workStatusEvents } from '../db/schema';
import { and, desc, eq, gte, lte } from 'drizzle-orm';

const toJsonValue = <T>(value: T): T => {
  const jsonString = JSON.stringify(value, (_key, innerValue) => {
    if (typeof innerValue === 'bigint') {
      return innerValue.toString();
    }
    return innerValue;
  });

  return JSON.parse(jsonString) as T;
};

export class TrackerService {
  private static instance: TrackerService;

  private constructor() {
  }

  public static getInstance(): TrackerService {
    if (!TrackerService.instance) {
      TrackerService.instance = new TrackerService();
    }
    return TrackerService.instance;
  }

  async setWorkStatus(status: string, reason?: string, ttlSeconds?: number) {
    let expiresAt = undefined;
    if (ttlSeconds) {
      expiresAt = new Date(Date.now() + ttlSeconds * 1000);
    }

    const now = new Date();

    db.insert(workStatusEvents).values({
      source: 'manual',
      status,
      reason: reason ?? null,
      expiresAt,
      createdAt: now
    }).run();

    return {
      source: 'manual',
      status,
      reason: reason ?? null,
      expiresAt,
      createdAt: now
    };
  }

  async setLocation(latitude: number, longitude: number, locationName?: string, source: string = 'manual', ttlSeconds?: number) {
    let expiresAt = undefined;
    if (ttlSeconds) {
      expiresAt = new Date(Date.now() + ttlSeconds * 1000);
    }

    const now = new Date();

    db.insert(locationEvents).values({
      source,
      latitude,
      longitude,
      name: locationName ?? null,
      expiresAt,
      createdAt: now
    }).run();

    return {
      source,
      latitude,
      longitude,
      name: locationName ?? null,
      expiresAt,
      createdAt: now
    };
  }

  async getLocationHistory(from?: Date, to?: Date, limit: number = 50) {
    const filters = [];

    if (from) {
      filters.push(gte(locationEvents.createdAt, from));
    }

    if (to) {
      filters.push(lte(locationEvents.createdAt, to));
    }

    const whereClause = filters.length ? and(...filters) : undefined;

    const query = whereClause
      ? db.select().from(locationEvents).where(whereClause)
      : db.select().from(locationEvents);

    return query.orderBy(desc(locationEvents.createdAt)).limit(limit).all();
  }

  async upsertSchedule(date: string, workStatus?: string, location?: any, reason?: string) {
    const patchData: Record<string, unknown> = {};
    if (workStatus) {
      patchData.workStatus = workStatus;
    }
    if (location) {
      patchData.location = location;
    }
    if (reason) {
      patchData.reason = reason;
    }

    const patch = toJsonValue(patchData);
    const now = new Date();

    db.insert(scheduledStatus)
      .values({ date, patch, createdAt: now, updatedAt: now })
      .onConflictDoUpdate({
        target: scheduledStatus.date,
        set: { patch, updatedAt: now }
      })
      .run();

    return db.select().from(scheduledStatus).where(eq(scheduledStatus.date, date)).get();
  }

  async listSchedules(from?: string, to?: string) {
    const filters = [];
    if (from) {
      filters.push(gte(scheduledStatus.date, from));
    }
    if (to) {
      filters.push(lte(scheduledStatus.date, to));
    }

    const whereClause = filters.length ? and(...filters) : undefined;
    const query = whereClause
      ? db.select().from(scheduledStatus).where(whereClause)
      : db.select().from(scheduledStatus);

    return query.orderBy(scheduledStatus.date).all();
  }

  async deleteSchedule(date: string) {
    return db.delete(scheduledStatus).where(eq(scheduledStatus.date, date)).run();
  }
}
