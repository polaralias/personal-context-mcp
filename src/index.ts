import 'dotenv/config';
import express from 'express';
import path from 'path';
import connectRoutes from './routes/connect';
import tokenRoutes from './routes/token';
import registerRoutes from './routes/register';
import wellKnownRoutes from './routes/well-known';
import { handleMcpRequest } from './server/mcp';
import { authenticateMcp } from './middleware/mcpAuth';
import { startJobs } from './jobs';
import { initDatabase } from './db';
import { requestLogger } from './middleware/logger';
import { createLogger } from './logger';
import { getMasterKeyInfo } from './utils/masterKey';
import { getConnectSchema, getUserBoundSchema } from './config/schema/mcp';
import apiKeyRoutes from './routes/api-keys';
import metricsRoutes, { metrics } from './routes/metrics';

const app = express();
const port = process.env.PORT || 3000;
const logger = createLogger('server');

app.set('trust proxy', true);

app.use((req, res, next) => {
  if (req.secure) {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }

  // Security: Validate Origin header to prevent DNS rebinding
  const origin = req.headers.origin || req.headers.referer;
  if (origin) {
    try {
      const originUrl = new URL(origin);
      // For local development, allow localhost and 127.0.0.1
      // In production, we should ideally have an allowed list
      const allowedHosts = ['localhost', '127.0.0.1', process.env.ALLOWED_HOST].filter(Boolean);
      const isAllowed = allowedHosts.some(host => originUrl.hostname === host || originUrl.hostname.endsWith('.' + host));

      if (!isAllowed && process.env.NODE_ENV === 'production') {
        logger.warn({ origin: originUrl.hostname }, 'Blocked request from unauthorized origin');
        return res.status(403).json({ error: 'Origin not allowed' });
      }
    } catch (e) {
      // If URL parsing fails, ignore or block
    }
  }

  next();
});

app.use(express.json());
app.use(express.urlencoded({ extended: true })); // Support form data
app.use(requestLogger);
app.use((req, res, next) => {
  if (req.path === '/metrics') {
    return next();
  }

  metrics.requests_total += 1;
  metrics.requests_in_flight += 1;
  res.on('finish', () => {
    metrics.requests_in_flight -= 1;
    if (res.statusCode >= 400) {
      metrics.errors_total += 1;
    }
  });
  next();
});

// Simple cookie parser middleware for CSRF if needed (routes/connect.ts does its own parsing in my implementation, but good to have globally if needed)
app.use((req, _res, next) => {
  if (req.headers.cookie) {
    req.cookies = req.headers.cookie.split('; ').reduce((acc: any, curr) => {
      const [key, value] = curr.split('=');
      if (key && value) {
        acc[key.trim()] = value.trim();
      }
      return acc;
    }, {});
  } else {
    req.cookies = {};
  }
  next();
});

// Serve static UI
app.use(express.static(path.join(__dirname, 'public'), { index: false }));

app.get('/api/config-status', (_req, res) => {
  const info = getMasterKeyInfo();
  if (info.status !== 'present') {
    return res.json({ status: 'missing' });
  }
  return res.json({
    status: 'present',
    format: info.derivation === 'hex-decode' ? 'hex' : 'passphrase'
  });
});

// API Config Schema
app.get('/api/config-schema', (_req, res) => {
  res.json(getUserBoundSchema());
});

// API Connect Schema (for /connect flow)
app.get('/api/connect-schema', (_req, res) => {
  res.json(getConnectSchema());
});

app.get('/healthz', (_req, res) => {
  res.json({ status: 'ok' });
});

// API Keys - Standardized mounting
app.use('/api/api-keys', apiKeyRoutes);

app.get('/', (req, res) => {
  if (req.headers.accept === 'text/event-stream') {
    return res.redirect('/mcp');
  }
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// OAuth Routes
app.use('/metrics', metricsRoutes);
app.use('/oauth', connectRoutes);
app.use('/connect', connectRoutes); // Legacy support for tests
app.use('/authorize', connectRoutes); // Standard fallback
app.use('/oauth/token', tokenRoutes);
app.use('/token', tokenRoutes); // Standard fallback
app.use('/oauth/register', registerRoutes);
app.use('/register', registerRoutes); // Standard fallback
app.use('/oauth/.well-known', wellKnownRoutes);
app.use('/.well-known', wellKnownRoutes);

// MCP Streamable HTTP endpoint
app.all('/mcp', authenticateMcp, handleMcpRequest);
app.all('/key=:apiKey', authenticateMcp, handleMcpRequest);
app.all('/key=:apiKey/mcp', authenticateMcp, handleMcpRequest);

if (require.main === module) {
  (async () => {
    logger.info('Server boot sequence initiated...');
    const keyInfo = getMasterKeyInfo();

    if (keyInfo.status !== 'present') {
      logger.error({ status: keyInfo.status }, 'MASTER_KEY is missing. Refusing to start.');
      setTimeout(() => process.exit(1), 100);
    } else {
      logger.info({ derivation: keyInfo.derivation }, 'MASTER_KEY validated');

      if (keyInfo.isInsecureDefault) {
        if (process.env.NODE_ENV === 'production') {
          logger.error('MASTER_KEY is set to the insecure default. Refusing to start in production.');
          setTimeout(() => process.exit(1), 100);
          return;
        } else {
          logger.warn('SECURITY WARNING: Using insecure default MASTER_KEY (development only).');
        }
      }

      logger.info('Connecting to database and initializing schema...');
      try {
        initDatabase();
        logger.info('Database initialization completed successfully');
        const host = process.env.HOST || '0.0.0.0';
        const server = app.listen(Number(port), host, () => {
          logger.info({ port, host, node_env: process.env.NODE_ENV }, 'SERVER STARTED AND LISTENING');
          startJobs();
        });

        server.on('error', (err) => {
          logger.error({ err }, 'Server failed to start listening');
        });
      } catch (error: any) {
        logger.error({ err: error.message, stack: error.stack }, 'FAILED TO RUN MIGRATIONS - SERVER HALTED');
        setTimeout(() => process.exit(1), 100);
      }
    }
  })();
}

export default app;
