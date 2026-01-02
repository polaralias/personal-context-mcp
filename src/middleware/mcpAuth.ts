import { Request, Response, NextFunction } from 'express';
import { createLogger } from '../logger';
import { verifyToken, getConnection, decryptConfig } from '../services/auth';

const logger = createLogger('middleware:mcpAuth');

// Extend Request type to include mcpConfig
declare global {
    namespace Express {
        interface Request {
            mcpConfig?: any;
        }
    }
}

export const authenticateMcp = async (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers['authorization'];

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
      logger.warn({ ip: req.ip }, 'Missing or invalid Authorization header');
      return res.status(401).json({ error: 'Unauthorized' });
  }

  const token = authHeader.slice(7);

  // Verify JWT
  const connectionId = verifyToken(token);
  if (!connectionId) {
      logger.warn({ ip: req.ip }, 'Invalid token');
      return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
      const connection = await getConnection(connectionId);
      if (!connection) {
          logger.warn({ ip: req.ip, connectionId }, 'Connection not found');
          return res.status(401).json({ error: 'Unauthorized' });
      }

      // Decrypt config and attach
      const config = decryptConfig(connection.configEncrypted);
      req.mcpConfig = config;

      next();
  } catch (error) {
      logger.error({ err: error }, 'Error authenticating MCP request');
      return res.status(500).json({ error: 'Internal Server Error' });
  }
};
