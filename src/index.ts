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
import { hasMasterKey, getMasterKeyInfo } from './utils/masterKey';
import apiKeyRoutes from './routes/api-keys';

const app = express();
const swaggerDocument = YAML.load('./openapi.yaml');
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

// API Config Status
app.get('/api/master-key-status', (_req, res) => {
  res.json({ configured: hasMasterKey() });
});

app.get('/api/config-status', (_req, res) => {
  const info = getMasterKeyInfo();
  res.json({
      status: info.status,
      format: info.status === 'present' ? (info.derivation === 'hex-decode' ? '64-hex' : 'passphrase') : undefined,
      isFallback: info.isInsecureDefault
  });
});

// API Config Schema
app.get('/api/config-schema', (_req, res) => {
  if (process.env.API_KEY_MODE === 'user_bound') {
    // Return ClickUp-like schema as per prompt requirements
    // "Repo’s ClickUp schema (explicit): apiKey (password, required, placeholder pk_..., help text), teamId (optional text)"
    // I should return a structure compatible with `app.js` render logic.
    res.json({
        fields: [
            {
                name: 'apiKey',
                label: 'ClickUp API Key',
                type: 'password',
                required: true,
                placeholder: 'pk_...',
                description: 'Your personal API token from ClickUp settings'
            },
            {
                name: 'teamId',
                label: 'Team ID',
                type: 'text',
                required: false,
                description: 'Optional: ID of the workspace to use'
            }
        ]
    });
  } else {
    res.status(404).json({ error: 'User-bound API keys are disabled' });
  }
});

// API Connect Schema (for /connect flow)
app.get('/api/connect-schema', (_req, res) => {
     res.json({
        fields: [
             {
                name: 'apiKey',
                label: 'ClickUp API Key',
                type: 'password',
                required: true,
                placeholder: 'pk_...',
                description: 'Your personal API token from ClickUp settings'
            },
            // Add other fields as per prompt "readOnly, selectiveWrite, writeSpaces[], writeLists[]"
            {
                name: 'readOnly',
                label: 'Read Only',
                type: 'checkbox',
                description: 'If checked, the server will not modify any data'
            },
            {
                name: 'selectiveWrite',
                label: 'Selective Write',
                type: 'checkbox',
                description: 'Enable granular write permissions'
            },
             {
                name: 'writeSpaces',
                label: 'Write Spaces',
                type: 'text',
                format: 'csv', // Frontend handles CSV splitting
                description: 'Comma-separated list of Space IDs allowed to write to'
            },
            {
                name: 'writeLists',
                label: 'Write Lists',
                type: 'text',
                format: 'csv',
                description: 'Comma-separated list of List IDs allowed to write to'
            }
        ]
     });
});


// API Keys - Standardized mounting
app.use('/api/api-keys', apiKeyRoutes);

// Root Route - Login or Provisioning UI
app.get('/', (_req, res) => {
  const { SMITHERY } = process.env;
  if (SMITHERY && SMITHERY !== 'false') {
      // Redirect behavior if SMITHERY is set and not false (default repo behavior)
      // But prompt says "Recommended default for replication: serve local UI at /".
      // And "if not set to "false", / redirects away rather than serving the local UI".
      // I will respect SMITHERY env var.
      return res.redirect('https://smithery.ai'); // Example redirect
  }

  // Serve the unified UI (login + provisioning)
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// OAuth Routes
app.use('/connect', connectRoutes);
app.use('/token', tokenRoutes);
app.use('/register', registerRoutes);
app.use('/.well-known', wellKnownRoutes);

// MCP Streamable HTTP endpoint
app.all('/mcp', authenticateMcp, handleMcpRequest);

// Legacy routes
app.use('/api/auth', authRoutes);

// Docs
app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

// Health
const healthHandler = async (req: express.Request, res: express.Response) => {
  try {
    if (req.query.check_db) {
        await prisma.$queryRaw`SELECT 1`;
    }
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
