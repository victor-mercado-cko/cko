import { createLogger, format, transports } from 'winston';
import type { Request, Response, NextFunction } from 'express';

const logger = createLogger({
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  format: format.combine(format.timestamp(), format.json()),
  transports: [new transports.Console()],
});

export { logger };

export function requestLogger(req: Request, res: Response, next: NextFunction) {
  const start = Date.now();

  res.on('finish', () => {
    logger.info('http', {
      method: req.method,
      path: req.path,
      status: res.statusCode,
      ms: Date.now() - start,
      requestId: req.ctx?.requestId,
      merchantId: req.ctx?.merchantId,
      ip: req.ip,
    });
  });

  next();
}
