import type { NextFunction, Request, Response } from 'express';
import { createLogger, getRequestId } from '../logger';

const logger = createLogger('http');

export const requestLogger = (req: Request, res: Response, next: NextFunction) => {
  const startTime = process.hrtime.bigint();
  const requestId = getRequestId(req);

  res.on('finish', () => {
    const durationMs = Number(process.hrtime.bigint() - startTime) / 1_000_000;
    logger.info({
      requestId,
      method: req.method,
      path: req.originalUrl,
      statusCode: res.statusCode,
      durationMs: Number(durationMs.toFixed(2)),
      userAgent: req.get('user-agent') || undefined,
    }, 'request completed');
  });

  next();
};
