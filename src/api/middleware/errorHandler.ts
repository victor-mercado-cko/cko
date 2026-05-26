import type { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { VaultError } from '../../services/vaultService';
import { logger } from './requestLogger';

const HTTP_STATUS: Record<string, number> = {
  INVALID_PAN: 422,
  EXPIRED_CARD: 422,
  NOT_FOUND: 404,
  INSTRUMENT_INACTIVE: 422,
  FORBIDDEN: 403,
  UNAUTHORIZED: 401,
};

export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction,
) {
  if (err instanceof ZodError) {
    res.status(422).json({
      error: 'VALIDATION_ERROR',
      message: 'Request validation failed',
      details: err.errors.map((e) => ({ path: e.path.join('.'), message: e.message })),
    });
    return;
  }

  if (err instanceof VaultError) {
    const status = HTTP_STATUS[err.code] ?? 400;
    res.status(status).json({ error: err.code, message: err.message });
    return;
  }

  logger.error('Unhandled error', { err, requestId: req.ctx?.requestId });
  res.status(500).json({ error: 'INTERNAL_ERROR', message: 'An unexpected error occurred' });
}
