import { createHash } from 'crypto';
import { randomUUID } from 'crypto';
import type { Request, Response, NextFunction } from 'express';
import { query } from '../../database/connection';
import type { RequestContext } from '../../types';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      ctx: RequestContext;
    }
  }
}

function extractBearer(header: string | undefined): string | null {
  if (!header) return null;
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match ? match[1] : null;
}

export function requireScope(scope: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.ctx.scopes.includes(scope) && !req.ctx.scopes.includes('admin')) {
      res.status(403).json({ error: 'FORBIDDEN', message: `Required scope: ${scope}` });
      return;
    }
    next();
  };
}

export async function authenticate(req: Request, res: Response, next: NextFunction) {
  const raw = extractBearer(req.headers.authorization);

  if (!raw) {
    res.status(401).json({ error: 'UNAUTHORIZED', message: 'Missing Bearer token' });
    return;
  }

  const keyHash = createHash('sha256').update(raw).digest('hex');

  const result = await query<Record<string, unknown>>(
    `SELECT id, merchant_id, scopes, status, expires_at FROM api_keys WHERE key_hash = $1`,
    [keyHash],
  );

  if (result.rows.length === 0) {
    res.status(401).json({ error: 'UNAUTHORIZED', message: 'Invalid API key' });
    return;
  }

  const key = result.rows[0];

  if (key['status'] !== 'active') {
    res.status(401).json({ error: 'UNAUTHORIZED', message: 'API key is not active' });
    return;
  }

  if (key['expires_at'] && new Date(key['expires_at'] as string) < new Date()) {
    res.status(401).json({ error: 'UNAUTHORIZED', message: 'API key has expired' });
    return;
  }

  // Fire-and-forget last_used_at update — don't block the request.
  query(`UPDATE api_keys SET last_used_at = NOW() WHERE id = $1`, [key['id']]).catch(() => {});

  req.ctx = {
    requestId: (req.headers['x-request-id'] as string) ?? randomUUID(),
    merchantId: key['merchant_id'] as string,
    apiKeyId: key['id'] as string,
    scopes: key['scopes'] as string[],
    ip: req.ip ?? req.socket.remoteAddress ?? 'unknown',
    userAgent: req.headers['user-agent'] ?? '',
  };

  next();
}
