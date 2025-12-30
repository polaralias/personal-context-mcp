import { Request, Response, NextFunction } from 'express';
import prisma from '../db';

export const authenticate = async (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: Missing or invalid token' });
  }

  const token = authHeader.split(' ')[1];

  // 1. Check Environment Master Token
  if (process.env.AUTH_TOKEN && token === process.env.AUTH_TOKEN) {
    return next();
  }

  // 2. Check Database Sessions
  try {
    const session = await prisma.clientSession.findUnique({
      where: { token }
    });

    if (session) {
      // Check expiry if set
      if (session.expiresAt && session.expiresAt < new Date()) {
        return res.status(401).json({ error: 'Unauthorized: Token expired' });
      }
      return next();
    }
  } catch (error) {
    console.error('Auth Middleware Error:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }

  return res.status(401).json({ error: 'Unauthorized: Invalid token' });
};
