import { Router, Request, Response, NextFunction } from 'express';
import prisma from '../db';
import { StatusResolver } from '../services/resolver';
import { HolidayService } from '../services/holiday';
import { createLogger, getRequestId } from '../logger';

const router = Router();
const resolver = StatusResolver.getInstance();
const holidayService = HolidayService.getInstance();
const logger = createLogger('routes:mcp');

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
        logger.error({ err: error, requestId: getRequestId(req) }, 'auth error');
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
router.post('/messages', authenticate, async (req: Request, res: Response) => {
  const message = req.body;
  const requestId = getRequestId(req);

  logger.info({ requestId, message }, 'received message');

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

  if (message.method === 'notifications/initialized') {
      res.json({ jsonrpc: "2.0", id: message.id, result: {} });
      return;
  }

  if (message.method === 'tools/list') {
      res.json({
          jsonrpc: "2.0",
          id: message.id,
          result: {
              tools: [
                  {
                      name: "status_get_now",
                      description: "Get resolved status for now",
                      inputSchema: { type: "object", properties: {} }
                  },
                  {
                      name: "status_get_date",
                      description: "Get resolved status for a specific date",
                      inputSchema: {
                          type: "object",
                          properties: {
                              date: { type: "string", description: "YYYY-MM-DD" }
                          },
                          required: ["date"]
                      }
                  },
                  {
                      name: "status_set_override",
                      description: "Set manual status override",
                      inputSchema: {
                          type: "object",
                          properties: {
                              status: { type: "string" },
                              reason: { type: "string" },
                              ttlSeconds: { type: "integer" }
                          },
                          required: ["status"]
                      }
                  },
                  {
                    name: "status_set_work",
                    description: "Set manual work status override (alias for set_override)",
                    inputSchema: {
                        type: "object",
                        properties: {
                            workStatus: { type: "string" },
                            reason: { type: "string" },
                            ttlSeconds: { type: "integer" }
                        },
                        required: ["workStatus"]
                    }
                  },
                  {
                      name: "status_schedule_set",
                      description: "Set scheduled override for a date",
                      inputSchema: {
                          type: "object",
                          properties: {
                              date: { type: "string", description: "YYYY-MM-DD" },
                              workStatus: { type: "string" },
                              reason: { type: "string" }
                          },
                          required: ["date", "workStatus"]
                      }
                  },
                  {
                      name: "status_schedule_list",
                      description: "List scheduled overrides",
                      inputSchema: {
                          type: "object",
                          properties: {
                              from: { type: "string" },
                              to: { type: "string" }
                          }
                      }
                  },
                  {
                      name: "status_schedule_delete",
                      description: "Delete scheduled override",
                      inputSchema: {
                          type: "object",
                          properties: {
                              date: { type: "string" }
                          },
                          required: ["date"]
                      }
                  },
                  {
                      name: "holidays_list",
                      description: "List holidays for current year",
                      inputSchema: {
                          type: "object",
                          properties: {
                              region: { type: "string" }
                          }
                      }
                  }
              ]
          }
      });
      return;
  }

  if (message.method === 'tools/call') {
      try {
          const { name, arguments: args } = message.params;

          let result: any = {};

          switch (name) {
              case 'status_get_now':
                  result = await resolver.resolveStatus();
                  break;
              case 'status_get_date':
                  if (!args.date) throw new Error("Missing date");
                  result = await resolver.resolveStatus(new Date(args.date));
                  break;
              case 'status_set_override':
                  if (!args.status) throw new Error("Missing status");
                  let expiresAt = undefined;
                  if (args.ttlSeconds) {
                      expiresAt = new Date(Date.now() + args.ttlSeconds * 1000);
                  }
                  await prisma.workStatusEvent.create({
                      data: {
                          source: 'manual',
                          status: args.status,
                          reason: args.reason,
                          expiresAt
                      }
                  });
                  result = await resolver.resolveStatus();
                  break;
              case 'status_set_work':
                    if (!args.workStatus) throw new Error("Missing workStatus");
                    let workExpiresAt = undefined;
                    if (args.ttlSeconds) {
                        workExpiresAt = new Date(Date.now() + args.ttlSeconds * 1000);
                    }
                    await prisma.workStatusEvent.create({
                        data: {
                            source: 'manual',
                            status: args.workStatus,
                            reason: args.reason,
                            expiresAt: workExpiresAt
                        }
                    });
                    result = await resolver.resolveStatus();
                    break;
              case 'status_schedule_set':
                  if (!args.date || !args.workStatus) throw new Error("Missing date or workStatus");
                  await prisma.scheduledStatus.upsert({
                      where: { date: args.date },
                      update: { patch: { workStatus: args.workStatus, reason: args.reason } },
                      create: { date: args.date, patch: { workStatus: args.workStatus, reason: args.reason } }
                  });
                  result = { success: true };
                  break;
              case 'status_schedule_list':
                  result = await prisma.scheduledStatus.findMany({
                      where: {
                          date: {
                              gte: args.from,
                              lte: args.to
                          }
                      },
                      orderBy: { date: 'asc' }
                  });
                  break;
              case 'status_schedule_delete':
                  if (!args.date) throw new Error("Missing date");
                  await prisma.scheduledStatus.delete({
                      where: { date: args.date }
                  }).catch(() => {}); // Ignore not found
                  result = { success: true };
                  break;
              case 'holidays_list':
                  result = await holidayService.fetchHolidays(args.region);
                  break;
              default:
                  throw new Error(`Unknown tool: ${name}`);
          }

          res.json({
              jsonrpc: "2.0",
              id: message.id,
              result: {
                  content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
              }
          });

      } catch (error: any) {
          logger.error({ err: error, requestId }, 'tool call error');
          res.json({
              jsonrpc: "2.0",
              id: message.id,
              error: {
                  code: -32603,
                  message: error.message || "Internal error"
              }
          });
      }
      return;
  }

  res.json({ jsonrpc: "2.0", id: message.id, result: {} });
});

export default router;
