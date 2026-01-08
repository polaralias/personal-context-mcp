import 'dotenv/config';
import express from 'express';
import swaggerUi from 'swagger-ui-express';
import YAML from 'yamljs';
import path from 'path';
import authRoutes from './routes/auth';
import connectRoutes from './routes/connect';
import tokenRoutes from './routes/token';
import registerRoutes from './routes/register';
import wellKnownRoutes from './routes/well-known';
import { handleMcpRequest } from './server/mcp';
import { authenticateMcp } from './middleware/mcpAuth';
import { startJobs } from './jobs';
import prisma from './db';
import { requestLogger } from './middleware/logger';
import { createLogger, getRequestId } from './logger';
import { hasMasterKey } from './utils/masterKey';
import { renderHtml } from './routes/connect';
import apiKeyRoutes from './routes/api-keys';
import { createConnection, getConnection, signToken } from './services/auth';
import { configFields } from './config/schema/personal-context';

const app = express();
const swaggerDocument = YAML.load('./openapi.yaml');
const port = process.env.PORT || 3000;
const logger = createLogger('server');

app.set('trust proxy', true);

app.use(express.json());
app.use(express.urlencoded({ extended: true })); // Support form data
app.use(requestLogger);

// Serve static UI
app.use(express.static(path.join(__dirname, 'public'), { index: false }));

// ... existing code ...

// API Config Status
app.get('/api/master-key-status', (_req, res) => {
  res.json({ configured: hasMasterKey() });
});

app.get('/api/config-status', (_req, res) => {
  res.json({ status: hasMasterKey() ? 'present' : 'missing' });
});

// API Config Schema
app.get('/api/config-schema', (_req, res) => {
  if (process.env.API_KEY_MODE === 'user_bound') {
    res.json({ fields: configFields });
  } else {
    res.status(404).json({ error: 'User-bound API keys are disabled' });
  }
});

// API Keys - Standardized mounting
app.use('/api/api-keys', apiKeyRoutes);

// Verify Master Key (UI Login)
app.post('/api/verify-master-key', (req, res) => {
  const { masterKey } = req.body;
  const actualKey = process.env.MASTER_KEY;
  if (actualKey && masterKey === actualKey) {
    res.json({ success: true });
  } else {
    res.status(401).json({ success: false, error: 'Invalid Master Key' });
  }
});

// Root Route - Login or Provisioning UI
app.get('/', (req, res) => {
  const { redirect_uri, state, code_challenge, code_challenge_method } = req.query;

  // If request looks like an OAuth authorization request, render the connect UI
  if (redirect_uri && state && code_challenge && code_challenge_method === 'S256') {
    return res.send(renderHtml(undefined, undefined, req.query));
  }

  // Serve the unified UI (login + provisioning)
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Connection management and session routes removed to prevent visibility of existing keys/connections.
// OAuth flows (/connect, /token, etc.) remain as they are required for legitimate client use.

// New Auth Routes
app.use('/connect', connectRoutes);
app.use('/token', tokenRoutes);
app.use('/register', registerRoutes);
app.use('/.well-known', wellKnownRoutes);

// MCP Streamable HTTP endpoint
app.all('/mcp', authenticateMcp, handleMcpRequest);

// Legacy routes (kept but return 501 as per auth.ts)
app.use('/api/auth', authRoutes);

// Docs
app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

// Health
const healthHandler = async (req: express.Request, res: express.Response) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: 'ok', db: 'ok', timestamp: new Date().toISOString() });
  } catch (error) {
    logger.error({ err: error, requestId: getRequestId(req) }, 'health check failed');
    res.status(503).json({ status: 'error', db: 'unavailable', timestamp: new Date().toISOString() });
  }
};

app.get('/healthz', healthHandler);
app.get('/health', healthHandler);


if (require.main === module) {
  app.listen(port, () => {
    logger.info({ port }, 'server started');
    startJobs();
  });
}

export default app;
