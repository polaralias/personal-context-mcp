import express from 'express';
import swaggerUi from 'swagger-ui-express';
import YAML from 'yamljs';
import path from 'path';
import statusRoutes from './routes/status';
import mcpRoutes from './routes/mcp';
import authRoutes from './routes/auth';
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
app.use(requestLogger);

// Serve static UI
app.use(express.static(path.join(__dirname, 'public')));
app.get('/', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'config.html'));
});

// API Routes
app.use('/status', statusRoutes);
app.use('/mcp', mcpRoutes);
app.use('/api/auth', authRoutes);

// Docs
app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

// Health
app.get('/healthz', async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: 'ok', db: 'ok', timestamp: new Date().toISOString() });
  } catch (error) {
    logger.error({ err: error, requestId: getRequestId(req) }, 'health check failed');
    res.status(503).json({ status: 'error', db: 'unavailable', timestamp: new Date().toISOString() });
  }
});

if (require.main === module) {
  app.listen(port, () => {
    logger.info({ port }, 'server started');
    startJobs();
  });
}

export default app;
