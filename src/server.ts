import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { config } from './config';
import { authenticate } from './api/middleware/auth';
import { requestLogger } from './api/middleware/requestLogger';
import { errorHandler } from './api/middleware/errorHandler';
import healthRouter from './api/routes/health';
import instrumentsRouter from './api/routes/instruments';
import chargesRouter from './api/routes/charges';

const app = express();

// Security headers
app.use(helmet());
app.use(cors({ origin: false }));  // no browser CORS — vault is server-to-server only

// Body parsing
app.use(express.json({ limit: '64kb' }));

// Rate limiting — vault endpoints are not high-throughput UI calls
const limiter = rateLimit({
  windowMs: 60_000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'RATE_LIMITED', message: 'Too many requests, please retry later' },
});
app.use(limiter);

// Request logging
app.use(requestLogger);

// Unauthenticated
app.use('/v1', healthRouter);

// All vault routes require a valid API key
app.use('/v1/instruments', authenticate, instrumentsRouter);
app.use('/v1/instruments/:token/charges', authenticate, chargesRouter);

// 404 fallthrough
app.use((_req, res) => {
  res.status(404).json({ error: 'NOT_FOUND', message: 'Route not found' });
});

// Central error handler
app.use(errorHandler);

if (require.main === module) {
  app.listen(config.port, () => {
    console.log(`CKO Vault listening on port ${config.port} [${config.nodeEnv}]`);
  });
}

export default app;
