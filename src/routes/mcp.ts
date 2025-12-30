import { Router, Request, Response, NextFunction } from 'express';
import prisma from '../db';

const router = Router();

// Middleware to check for authentication
const authenticate = async (req: Request, res: Response, next: NextFunction) => {
    let token = req.headers['authorization'];

    // Support "Bearer <token>"
    if (token && token.startsWith('Bearer ')) {
        token = token.slice(7);
    }

    if (!token) {
        return res.status(401).json({ error: 'Unauthorized: Missing token' });
    }

    try {
        const session = await prisma.clientSession.findUnique({
            where: { token }
        });

        if (!session) {
             return res.status(401).json({ error: 'Unauthorized: Invalid token' });
        }

        if (session.expiresAt < new Date()) {
            return res.status(401).json({ error: 'Unauthorized: Token expired' });
        }

        // Attach session to request if needed
        (req as any).userSession = session;
        next();
    } catch (error) {
        console.error('Auth error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

// Clients connected to the SSE stream
let clients: { id: number; res: Response }[] = [];

// GET /sse
router.get('/sse', authenticate, (req: Request, res: Response) => {
  const headers = {
    'Content-Type': 'text/event-stream',
    'Connection': 'keep-alive',
    'Cache-Control': 'no-cache',
  };
  res.writeHead(200, headers);

  const clientId = Date.now();
  const newClient = {
    id: clientId,
    res,
  };
  clients.push(newClient);

  const data = `data: ${JSON.stringify({ type: 'endpoint', uri: '/mcp/messages' })}\n\n`;
  res.write(data);

  req.on('close', () => {
    clients = clients.filter((c) => c.id !== clientId);
  });
});

// POST /messages
router.post('/messages', authenticate, (req: Request, res: Response) => {
  const message = req.body;

  console.log('Received message:', message);

  if (message.method === 'initialize') {
      res.json({
          jsonrpc: "2.0",
          id: message.id,
          result: {
              protocolVersion: "2024-11-05",
              capabilities: {},
              serverInfo: {
                  name: "status-mcp",
                  version: "1.0.0"
              }
          }
      });
      return;
  }

  res.json({ jsonrpc: "2.0", id: message.id, result: {} });
});

export default router;
