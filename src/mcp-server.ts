import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
// @ts-ignore
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";
import { Request, Response } from "express";
import prisma from "./db";
import { StatusResolver } from "./services/resolver";
import { HolidayService } from "./services/holiday";
import { createLogger } from "./logger";

const logger = createLogger('mcp-server');
const resolver = StatusResolver.getInstance();
const holidayService = HolidayService.getInstance();

const server = new McpServer({
  name: "status-mcp",
  version: "1.0.0"
});

// status_get_now
server.tool(
  "status_get_now",
  "Get resolved status for now",
  {},
  async () => {
    const result = await resolver.resolveStatus();
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
    };
  }
);

// status_get_date
server.tool(
  "status_get_date",
  "Get resolved status for a specific date",
  {
    date: z.string().describe("YYYY-MM-DD")
  },
  async ({ date }) => {
    const result = await resolver.resolveStatus(new Date(date));
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
    };
  }
);

// status_set_override
server.tool(
  "status_set_override",
  "Set manual status override",
  {
    status: z.string(),
    reason: z.string().optional(),
    ttlSeconds: z.number().int().optional()
  },
  async ({ status, reason, ttlSeconds }) => {
    let expiresAt: Date | undefined = undefined;
    if (ttlSeconds) {
      expiresAt = new Date(Date.now() + ttlSeconds * 1000);
    }
    await prisma.workStatusEvent.create({
      data: {
        source: 'manual',
        status,
        reason,
        expiresAt
      }
    });
    const result = await resolver.resolveStatus();
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
    };
  }
);

// status_set_work (alias for set_override)
server.tool(
  "status_set_work",
  "Set manual work status override (alias for set_override)",
  {
    workStatus: z.string(),
    reason: z.string().optional(),
    ttlSeconds: z.number().int().optional()
  },
  async ({ workStatus, reason, ttlSeconds }) => {
    let expiresAt: Date | undefined = undefined;
    if (ttlSeconds) {
      expiresAt = new Date(Date.now() + ttlSeconds * 1000);
    }
    await prisma.workStatusEvent.create({
      data: {
        source: 'manual',
        status: workStatus,
        reason,
        expiresAt
      }
    });
    const result = await resolver.resolveStatus();
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
    };
  }
);

// status_schedule_set
server.tool(
  "status_schedule_set",
  "Set scheduled override for a date",
  {
    date: z.string().describe("YYYY-MM-DD"),
    workStatus: z.string(),
    reason: z.string().optional()
  },
  async ({ date, workStatus, reason }) => {
    await prisma.scheduledStatus.upsert({
      where: { date },
      update: { patch: { workStatus, reason } },
      create: { date, patch: { workStatus, reason } }
    });
    return {
      content: [{ type: "text", text: JSON.stringify({ success: true }, null, 2) }]
    };
  }
);

// status_schedule_list
server.tool(
  "status_schedule_list",
  "List scheduled overrides",
  {
    from: z.string().optional(),
    to: z.string().optional()
  },
  async ({ from, to }) => {
    const where: any = {};
    if (from || to) {
      where.date = {};
      if (from) where.date.gte = from;
      if (to) where.date.lte = to;
    }

    const result = await prisma.scheduledStatus.findMany({
      where,
      orderBy: { date: 'asc' }
    });
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
    };
  }
);

// status_schedule_delete
server.tool(
  "status_schedule_delete",
  "Delete scheduled override",
  {
    date: z.string()
  },
  async ({ date }) => {
    try {
      await prisma.scheduledStatus.delete({
        where: { date }
      });
    } catch (e) {
      // Ignore not found
    }
    return {
      content: [{ type: "text", text: JSON.stringify({ success: true }, null, 2) }]
    };
  }
);

// holidays_list
server.tool(
  "holidays_list",
  "List holidays for current year",
  {
    region: z.string().optional()
  },
  async ({ region }) => {
    const result = await holidayService.fetchHolidays(region);
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
    };
  }
);

export async function handleMcpRequest(req: Request, res: Response) {
  logger.info({ method: req.method, url: req.url }, "Handling MCP request");
  try {
    const transport = new StreamableHTTPServerTransport();
    await server.connect(transport);
    logger.info("MCP server connected to transport");
    await transport.handleRequest(req, res, req.body);
  } catch (err) {
    logger.error({ err }, "Error handling MCP request");
    if (!res.headersSent) {
      res.status(500).send("Internal Server Error");
    }
  }
}
