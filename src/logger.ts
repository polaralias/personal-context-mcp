import pino from 'pino';
import type { Request } from 'express';

const baseLogger = pino({
  level: process.env.LOG_LEVEL || 'info',
});

export const createLogger = (component: string) => baseLogger.child({ component });

export const getRequestId = (req: Request): string | undefined => {
  const header = req.get('x-request-id') || req.get('x-correlation-id') || req.get('x-amzn-trace-id');
  return header || undefined;
};

export default baseLogger;
