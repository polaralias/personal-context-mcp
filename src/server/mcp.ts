import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";
import { Request, Response } from "express";
import prisma from '../db';
import { StatusResolver } from '../services/resolver';
import { HolidayService } from '../services/holiday';
import { createLogger, getRequestId } from '../logger';

const logger = createLogger('server:mcp');
const resolver = StatusResolver.getInstance();
const holidayService = HolidayService.getInstance();

// Create MCP Server
export const mcpServer = new McpServer({
    name: "status-mcp",
    version: "1.0.0"
});

// Register tools
mcpServer.tool(
    "status_get_now",
    "Get resolved status for now",
    {},
    async (args, extra) => {
        const result = await resolver.resolveStatus();
        return {
            content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
        };
    }
);

mcpServer.tool(
    "status_get_date",
    "Get resolved status for a specific date",
    {
        date: z.string().describe("YYYY-MM-DD")
    },
    async (args, extra) => {
        const result = await resolver.resolveStatus(new Date(args.date));
        return {
            content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
        };
    }
);

mcpServer.tool(
    "status_set_override",
    "Set manual status override",
    {
        status: z.string(),
        reason: z.string().optional(),
        ttlSeconds: z.number().int().optional()
    },
    async (args, extra) => {
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
        const result = await resolver.resolveStatus();
        return {
            content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
        };
    }
);

mcpServer.tool(
    "status_set_work",
    "Set manual work status override (alias for set_override)",
    {
        workStatus: z.string(),
        reason: z.string().optional(),
        ttlSeconds: z.number().int().optional()
    },
    async (args, extra) => {
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
        const result = await resolver.resolveStatus();
        return {
            content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
        };
    }
);

mcpServer.tool(
    "status_schedule_set",
    "Set scheduled override for a date",
    {
        date: z.string().describe("YYYY-MM-DD"),
        workStatus: z.string(),
        reason: z.string().optional()
    },
    async (args, extra) => {
        await prisma.scheduledStatus.upsert({
            where: { date: args.date },
            update: { patch: { workStatus: args.workStatus, reason: args.reason } },
            create: { date: args.date, patch: { workStatus: args.workStatus, reason: args.reason } }
        });
        return {
            content: [{ type: "text", text: JSON.stringify({ success: true }, null, 2) }]
        };
    }
);

mcpServer.tool(
    "status_schedule_list",
    "List scheduled overrides",
    {
        from: z.string().optional(),
        to: z.string().optional()
    },
    async (args, extra) => {
        const result = await prisma.scheduledStatus.findMany({
            where: {
                date: {
                    gte: args.from,
                    lte: args.to
                }
            },
            orderBy: { date: 'asc' }
        });
        return {
            content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
        };
    }
);

mcpServer.tool(
    "status_schedule_delete",
    "Delete scheduled override",
    {
        date: z.string()
    },
    async (args, extra) => {
        await prisma.scheduledStatus.delete({
            where: { date: args.date }
        }).catch(() => {}); // Ignore not found
        return {
            content: [{ type: "text", text: JSON.stringify({ success: true }, null, 2) }]
        };
    }
);

mcpServer.tool(
    "holidays_list",
    "List holidays for current year",
    {
        region: z.string().optional()
    },
    async (args, extra) => {
        const result = await holidayService.fetchHolidays(args.region);
        return {
            content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
        };
    }
);

// Instantiate transport once
const transport = new StreamableHTTPServerTransport();

let connectionPromise: Promise<void> | null = null;

// HTTP Handler
export const handleMcpRequest = async (req: Request, res: Response) => {
    // Check for auth context (set by middleware)
    if (!(req as any).userSession) {
        return res.status(401).json({ error: "Unauthorized" });
    }

    try {
        if (!connectionPromise) {
            connectionPromise = mcpServer.connect(transport);
        }
        await connectionPromise;

        // Delegate to transport
        await transport.handleRequest(req, res, req.body);
    } catch (err) {
        logger.error({ err, requestId: getRequestId(req) }, "MCP Transport error");
        if (!res.headersSent) {
            res.status(500).json({ error: "Internal Server Error" });
        }
    }
};
