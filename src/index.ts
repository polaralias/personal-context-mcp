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
import { runMigrations } from './db';
import { requestLogger } from './middleware/logger';
import { createLogger } from './logger';
import { hasMasterKey, getMasterKeyInfo } from './utils/masterKey';
import { getConnectSchema, getUserBoundSchema } from './config/schema/mcp';
import apiKeyRoutes from './routes/api-keys';

const app = express();
const port = process.env.PORT || 3000;
const logger = createLogger('server');

app.set('trust proxy', true);

app.use(express.json());
app.use(express.urlencoded({ extended: true })); // Support form data
app.use(requestLogger);

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


// API Keys - Standardized mounting
app.use('/api/api-keys', apiKeyRoutes);

app.get('/', (req, res) => {
  if (req.headers.accept === 'text/event-stream') {
    return res.redirect('/mcp');
  }
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// OAuth Routes
app.use('/connect', connectRoutes);
app.use('/token', tokenRoutes);
app.use('/register', registerRoutes);
app.use('/.well-known', wellKnownRoutes);

// MCP Streamable HTTP endpoint
app.all('/mcp', authenticateMcp, handleMcpRequest);
app.all('/key=:apiKey', authenticateMcp, handleMcpRequest);
app.all('/key=:apiKey/mcp', authenticateMcp, handleMcpRequest);

if (require.main === module) {
  if (!hasMasterKey()) {
    logger.error('MASTER_KEY is missing. Refusing to start.');
    process.exit(1);
  }

  runMigrations()
    .then(() => {
      app.listen(port, () => {
        logger.info({ port }, 'server started');
        startJobs();
      });
    })
    .catch((error) => {
      logger.error({ err: error }, 'Failed to run migrations');
      process.exit(1);
    });
}

export default app;
