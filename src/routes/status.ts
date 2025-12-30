import { Router } from 'express';
import { StatusResolver } from '../services/resolver';
import prisma from '../db';
import { authenticate } from '../middleware/auth';

const router = Router();

const resolver = StatusResolver.getInstance();

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0;

const isPositiveInteger = (value: unknown): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value > 0;

const isNumber = (value: unknown): value is number => typeof value === 'number' && !Number.isNaN(value);

const validateStatusOverride = (payload: any) => {
  if (!isNonEmptyString(payload?.status)) {
    return { valid: false, message: 'status is required' };
  }
  if (payload.ttlSeconds !== undefined && !isPositiveInteger(payload.ttlSeconds)) {
    return { valid: false, message: 'ttlSeconds must be a positive integer' };
  }
  if (payload.reason !== undefined && !isNonEmptyString(payload.reason)) {
    return { valid: false, message: 'reason must be a non-empty string' };
  }
  return { valid: true };
};

const validateWorkOverride = (payload: any) => {
  if (!isNonEmptyString(payload?.workStatus)) {
    return { valid: false, message: 'workStatus is required' };
  }
  if (payload.ttlSeconds !== undefined && !isPositiveInteger(payload.ttlSeconds)) {
    return { valid: false, message: 'ttlSeconds must be a positive integer' };
  }
  if (payload.reason !== undefined && !isNonEmptyString(payload.reason)) {
    return { valid: false, message: 'reason must be a non-empty string' };
  }
  return { valid: true };
};

const validateLocation = (payload: any) => {
  if (!isNumber(payload?.latitude) || !isNumber(payload?.longitude)) {
    return { valid: false, message: 'latitude and longitude are required numbers' };
  }
  if (payload.locationName !== undefined && !isNonEmptyString(payload.locationName)) {
    return { valid: false, message: 'locationName must be a non-empty string' };
  }
  if (payload.source !== undefined && !isNonEmptyString(payload.source)) {
    return { valid: false, message: 'source must be a non-empty string' };
  }
  if (payload.ttlSeconds !== undefined && !isPositiveInteger(payload.ttlSeconds)) {
    return { valid: false, message: 'ttlSeconds must be a positive integer' };
  }
  return { valid: true };
};

const validateSchedule = (payload: any) => {
  if (!isNonEmptyString(payload?.date) || !/^\d{4}-\d{2}-\d{2}$/.test(payload.date)) {
    return { valid: false, message: 'date must be YYYY-MM-DD' };
  }
  if (payload.workStatus !== undefined && !isNonEmptyString(payload.workStatus)) {
    return { valid: false, message: 'workStatus must be a non-empty string' };
  }
  if (payload.location !== undefined) {
    const location = payload.location;
    if (!isNumber(location?.latitude) || !isNumber(location?.longitude)) {
      return { valid: false, message: 'location requires latitude and longitude' };
    }
    if (location.locationName !== undefined && !isNonEmptyString(location.locationName)) {
      return { valid: false, message: 'locationName must be a non-empty string' };
    }
  }
  if (payload.reason !== undefined && !isNonEmptyString(payload.reason)) {
    return { valid: false, message: 'reason must be a non-empty string' };
  }
  return { valid: true };
};

const validateHistoryQuery = (payload: any) => {
  if (payload.from !== undefined && !isNonEmptyString(payload.from)) {
    return { valid: false, message: 'from must be a non-empty string' };
  }
  if (payload.to !== undefined && !isNonEmptyString(payload.to)) {
    return { valid: false, message: 'to must be a non-empty string' };
  }
  if (payload.limit !== undefined && !isNonEmptyString(payload.limit)) {
    return { valid: false, message: 'limit must be a non-empty string' };
  }
  return { valid: true };
};

// GET /status
router.get('/', async (req, res) => {
  try {
    const status = await resolver.resolveStatus();
    res.json(status);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// PUT /status (Manual Override)
router.put('/', authenticate, async (req, res) => {
  try {
    const validation = validateStatusOverride(req.body);
    if (!validation.valid) {
      return res.status(400).json({ error: 'Invalid payload', message: validation.message });
    }

    const { status, reason, ttlSeconds } = req.body;

    let expiresAt = undefined;
    if (ttlSeconds) {
      expiresAt = new Date(Date.now() + ttlSeconds * 1000);
    }

    await prisma.workStatusEvent.create({
      data: {
        source: 'manual',
        status,
        reason,
        expiresAt
      }
    });

    const resolved = await resolver.resolveStatus();
    res.json(resolved);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// GET /status/date/:date
router.get('/date/:date', async (req, res) => {
  try {
    const dateString = req.params.date;
    const date = new Date(dateString);

    if (isNaN(date.getTime())) {
        return res.status(400).json({ error: { code: "INVALID_DATE", message: "Date must be YYYY-MM-DD" } });
    }

    const status = await resolver.resolveStatus(date);
    res.json(status);
  } catch (error) {
     console.error(error);
     res.status(500).json({ error: 'Internal Server Error' });
  }
});

// GET /status/work
router.get('/work', async (req, res) => {
  try {
    const status = await resolver.resolveStatus();
    res.json({ workStatus: status.workStatus, effectiveDate: status.effectiveDate });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// PUT /status/work
router.put('/work', authenticate, async (req, res) => {
  try {
    const validation = validateWorkOverride(req.body);
    if (!validation.valid) {
      return res.status(400).json({ error: 'Invalid payload', message: validation.message });
    }

    const { workStatus, reason, ttlSeconds } = req.body;
    let expiresAt = undefined;
    if (ttlSeconds) {
      expiresAt = new Date(Date.now() + ttlSeconds * 1000);
    }

    await prisma.workStatusEvent.create({
      data: {
        source: 'manual',
        status: workStatus,
        reason,
        expiresAt
      }
    });

    const status = await resolver.resolveStatus();
    res.json({ workStatus: status.workStatus, effectiveDate: status.effectiveDate });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// GET /status/work/date/:date
router.get('/work/date/:date', async (req, res) => {
  try {
    const dateString = req.params.date;
    const date = new Date(dateString);

    if (isNaN(date.getTime())) {
      return res.status(400).json({ error: { code: 'INVALID_DATE', message: 'Date must be YYYY-MM-DD' } });
    }

    const status = await resolver.resolveStatus(date);
    res.json({ workStatus: status.workStatus, effectiveDate: status.effectiveDate });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// PUT /status/location
router.put('/location', authenticate, async (req, res) => {
  try {
    const validation = validateLocation(req.body);
    if (!validation.valid) {
      return res.status(400).json({ error: 'Invalid payload', message: validation.message });
    }

    const { latitude, longitude, locationName, source, ttlSeconds } = req.body;
    let expiresAt = undefined;
    if (ttlSeconds) {
      expiresAt = new Date(Date.now() + ttlSeconds * 1000);
    }

    await prisma.locationEvent.create({
      data: {
        source: source || 'manual',
        latitude,
        longitude,
        name: locationName,
        expiresAt
      }
    });

    const status = await resolver.resolveStatus();
    res.json({ location: status.location, effectiveDate: status.effectiveDate });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// GET /status/location
router.get('/location', async (req, res) => {
  try {
    const status = await resolver.resolveStatus();
    res.json({ location: status.location, effectiveDate: status.effectiveDate });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// GET /status/location/history
router.get('/location/history', async (req, res) => {
  try {
    const validation = validateHistoryQuery(req.query);
    if (!validation.valid) {
      return res.status(400).json({ error: 'Invalid query', message: validation.message });
    }

    const { from, to, limit } = req.query as Record<string, string | undefined>;
    const take = limit ? Number(limit) : 50;
    if (Number.isNaN(take) || take <= 0) {
      return res.status(400).json({ error: { code: 'INVALID_PAYLOAD', message: 'limit must be a positive number' } });
    }
    const range: { gte?: Date; lte?: Date } = {};

    if (from) {
      const fromDate = new Date(from);
      if (isNaN(fromDate.getTime())) {
        return res.status(400).json({ error: { code: 'INVALID_DATE', message: 'Invalid from date' } });
      }
      range.gte = fromDate;
    }

    if (to) {
      const toDate = new Date(to);
      if (isNaN(toDate.getTime())) {
        return res.status(400).json({ error: { code: 'INVALID_DATE', message: 'Invalid to date' } });
      }
      range.lte = toDate;
    }

    const events = await prisma.locationEvent.findMany({
      where: Object.keys(range).length ? { createdAt: range } : undefined,
      orderBy: { createdAt: 'desc' },
      take
    });

    res.json({
      events: events.map(event => ({
        latitude: event.latitude,
        longitude: event.longitude,
        locationName: event.name || undefined,
        source: event.source,
        timestamp: event.createdAt.toISOString()
      }))
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// PUT /status/schedule
router.put('/schedule', authenticate, async (req, res) => {
  try {
    const validation = validateSchedule(req.body);
    if (!validation.valid) {
      return res.status(400).json({ error: 'Invalid payload', message: validation.message });
    }

    const { date, workStatus, location, reason } = req.body;
    const patch: Record<string, unknown> = {};
    if (workStatus) {
      patch.workStatus = workStatus;
    }
    if (location) {
      patch.location = location;
    }
    if (reason) {
      patch.reason = reason;
    }

    await prisma.scheduledStatus.upsert({
      where: { date },
      update: { patch },
      create: { date, patch }
    });

    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// GET /status/schedule
router.get('/schedule', async (req, res) => {
    try {
        const { from, to } = req.query;
        // Basic implementation, could add filtering
        const schedules = await prisma.scheduledStatus.findMany({
            where: {
                date: {
                    gte: from as string | undefined,
                    lte: to as string | undefined
                }
            },
            orderBy: { date: 'asc' }
        });
        res.json(schedules);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// DELETE /status/schedule/:date
router.delete('/schedule/:date', authenticate, async (req, res) => {
  const date = req.params.date;
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return res.status(400).json({ error: 'Invalid date format. Use YYYY-MM-DD' });
  }

  try {
    await prisma.scheduledStatus.delete({
      where: { date }
    });
    res.json({ message: 'Scheduled status deleted' });
  } catch (error) {
    // Check if error is "Record to delete does not exist"
    // P2025 is Prisma's error code for this.
    // For now generic error handling:
    console.error('Error deleting scheduled status:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

export default router;
