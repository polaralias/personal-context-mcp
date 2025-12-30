import express from 'express';
import swaggerUi from 'swagger-ui-express';
import YAML from 'yamljs';
import path from 'path';
import statusRoutes from './routes/status';
import mcpRoutes from './routes/mcp';
import authRoutes from './routes/auth';
import { startJobs } from './jobs';

const app = express();
const swaggerDocument = YAML.load('./openapi.yaml');
const port = process.env.PORT || 3000;

app.use(express.json());

// Serve static UI
app.use(express.static(path.join(__dirname, 'public')));
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'config.html'));
});

// API Routes
app.use('/status', statusRoutes);
app.use('/mcp', mcpRoutes);
app.use('/api/auth', authRoutes);

// Docs
app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

// Health
app.get('/healthz', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

if (require.main === module) {
  app.listen(port, () => {
    console.log(`Server is running at http://localhost:${port}`);
    startJobs();
  });
}

export default app;
