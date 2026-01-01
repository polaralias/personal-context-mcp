import { Router, Request, Response } from 'express';

const router = Router();

// POST /authorize
router.post('/authorize', async (_req: Request, res: Response) => {
    res.status(501).json({ error: 'Auth flow temporarily disabled' });
});

// POST /token
router.post('/token', async (_req: Request, res: Response) => {
    res.status(501).json({ error: 'Auth flow temporarily disabled' });
});

export default router;
