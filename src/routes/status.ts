import { Router } from 'express';
import { StatusResolver } from '../services/resolver';
import prisma from '../db';

const router = Router();

const resolver = StatusResolver.getInstance();

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
router.put('/', async (req, res) => {
  try {
    const { status, reason, ttlSeconds } = req.body;

    if (!status) {
      return res.status(400).json({ error: 'Status is required' });
    }

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

// PUT /status/schedule
router.put('/schedule', async (req, res) => {
  try {
      const { date, ...patch } = req.body;
      if (!date) {
          return res.status(400).json({ error: 'Date is required' });
      }

      // Upsert
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

export default router;
