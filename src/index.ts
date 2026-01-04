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

const app = express();
const swaggerDocument = YAML.load('./openapi.yaml');
const port = process.env.PORT || 3000;
const logger = createLogger('server');

app.set('trust proxy', 1);

app.use(express.json());
app.use(express.urlencoded({ extended: true })); // Support form data
app.use(requestLogger);

// Serve static UI (Keep existing public folder for now, but connect overrides it if path matches)
app.use(express.static(path.join(__dirname, 'public')));
app.get('/', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'config.html'));
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
