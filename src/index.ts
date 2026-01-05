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

// Root Route - Dashboard or OAuth Authorisation or Provisioning
app.get('/', (req, res) => {
  const { redirect_uri, state, code_challenge, code_challenge_method } = req.query;

  // If request looks like an OAuth authorization request, render the connect UI
  if (redirect_uri && state && code_challenge && code_challenge_method === 'S256') {
    return res.send(renderHtml(undefined, undefined, req.query));
  }

  // If API Key mode is user_bound, serve the provisioning page
  if (process.env.API_KEY_MODE === 'user_bound') {
    return res.sendFile(path.join(__dirname, 'public', 'provision.html'));
  }

  // Otherwise, serve the dashboard
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// API config routes
app.use('/api-keys', apiKeyRoutes);

// API Config Status
app.get('/api/config-status', (_req, res) => {
  res.json({ status: hasMasterKey() ? 'present' : 'missing' });
});

// API Connections
app.get('/api/connections', async (req, res) => {
  try {
    const connections = await prisma.connection.findMany({
      orderBy: { createdAt: 'desc' }
    });
    // Remove sensitive config before sending
    const safeConnections = connections.map(c => {
      const { configEncrypted, ...rest } = c;
      return rest;
    });
    res.json(safeConnections);
  } catch (error) {
    logger.error({ err: error, requestId: getRequestId(req) }, 'failed to list connections');
    res.status(500).json({ error: 'failed_to_list_connections' });
  }
});

app.get('/api/connections/:id', async (req, res) => {
  try {
    const connection = await getConnection(req.params.id);
    if (!connection) {
      return res.status(404).json({ error: 'not_found' });
    }
    const { configEncrypted, ...rest } = connection;
    res.json(rest);
  } catch (error) {
    logger.error({ err: error, requestId: getRequestId(req) }, 'failed to get connection');
    res.status(500).json({ error: 'failed_to_get_connection' });
  }
});

app.post('/api/connections', async (req, res) => {
  if (!hasMasterKey()) {
    return res.status(400).json({ error: 'MASTER_KEY_MISSING', message: 'Connection creation blocked: MASTER_KEY is missing.' });
  }

  try {
    const { displayName, config } = req.body;
    const connection = await createConnection(displayName || 'New Connection', config || {});
    const { configEncrypted, ...rest } = connection;
    res.json(rest);
  } catch (error) {
    logger.error({ err: error, requestId: getRequestId(req) }, 'failed to create connection');
    res.status(500).json({ error: 'failed_to_create_connection' });
  }
});

// API Sessions
app.post('/api/sessions', async (req, res) => {
  if (!hasMasterKey()) {
    return res.status(400).json({ error: 'MASTER_KEY_MISSING', message: 'Session generation blocked: MASTER_KEY is missing.' });
  }

  try {
    const { connectionId } = req.body;
    if (!connectionId) {
      return res.status(400).json({ error: 'connection_id_required' });
    }

    const connection = await getConnection(connectionId);
    if (!connection) {
      return res.status(404).json({ error: 'connection_not_found' });
    }

    const token = signToken(connectionId);
    res.json({ accessToken: token });
  } catch (error) {
    logger.error({ err: error, requestId: getRequestId(req) }, 'failed to create session');
    res.status(500).json({ error: 'failed_to_create_session' });
  }
});

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
