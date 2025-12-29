import express from 'express';
import swaggerUi from 'swagger-ui-express';
import YAML from 'yamljs';
import statusRoutes from './routes/status';
import { startJobs } from './jobs';

const app = express();
const swaggerDocument = YAML.load('./openapi.yaml');
const port = process.env.PORT || 3000;

app.use(express.json());

app.get('/', (req, res) => {
  res.send('Status MCP Server');
});

app.use('/status', statusRoutes);
app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

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
