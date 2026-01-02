import { Request, Response, NextFunction } from 'express';
import { createLogger } from '../logger';

const logger = createLogger('middleware:mcpAuth');

export const authenticateMcp = async (req: Request, res: Response, next: NextFunction) => {
  const expectedToken = process.env.MCP_BEARER_TOKEN;

  // If no token configured, allow all
  if (!expectedToken) {
      return next();
  }

  let token = req.headers['authorization'];

  // Support "Bearer <token>"
  if (token && token.startsWith('Bearer ')) {
      token = token.slice(7);
  }

  if (!token || token !== expectedToken) {
      logger.warn({ ip: req.ip }, 'Unauthorized access attempt to MCP endpoint');
      return res.status(401).json({ error: 'Unauthorized' });
  }

  next();
};
