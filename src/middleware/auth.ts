import { Request, Response, NextFunction } from 'express';

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

  return res.status(401).json({ error: 'Unauthorized: Invalid token' });
};
