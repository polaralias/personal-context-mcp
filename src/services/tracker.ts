import { PrismaClient } from '@prisma/client';
import prisma from '../db';
import { toInputJsonObject } from '../utils/prismaJson';

export class TrackerService {
  private static instance: TrackerService;
  private prisma: PrismaClient;

  private constructor() {
    this.prisma = prisma;
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

    return this.prisma.workStatusEvent.create({
      data: {
        source: 'manual',
        status,
        reason,
        expiresAt
      }
    });
  }

  async setLocation(latitude: number, longitude: number, locationName?: string, source: string = 'manual', ttlSeconds?: number) {
    let expiresAt = undefined;
    if (ttlSeconds) {
      expiresAt = new Date(Date.now() + ttlSeconds * 1000);
    }

    return this.prisma.locationEvent.create({
      data: {
        source,
        latitude,
        longitude,
        name: locationName,
        expiresAt
      }
    });
  }

  async getLocationHistory(from?: Date, to?: Date, limit: number = 50) {
    const range: { gte?: Date; lte?: Date } = {};

    if (from) {
      range.gte = from;
    }

    if (to) {
      range.lte = to;
    }

    return this.prisma.locationEvent.findMany({
      where: Object.keys(range).length ? { createdAt: range } : undefined,
      orderBy: { createdAt: 'desc' },
      take: limit
    });
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

    const patch = toInputJsonObject(patchData);

    return this.prisma.scheduledStatus.upsert({
      where: { date },
      update: { patch },
      create: { date, patch }
    });
  }

  async listSchedules(from?: string, to?: string) {
    return this.prisma.scheduledStatus.findMany({
      where: {
        date: {
          gte: from,
          lte: to
        }
      },
      orderBy: { date: 'asc' }
    });
  }

  async deleteSchedule(date: string) {
    return this.prisma.scheduledStatus.delete({
      where: { date }
    });
  }
}
