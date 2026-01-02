import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";
import { Request, Response } from "express";
import { StatusResolver } from '../services/resolver';
import { HolidayService } from '../services/holiday';
import { TrackerService } from '../services/tracker';
import { createLogger, getRequestId } from '../logger';

const logger = createLogger('server:mcp');
const resolver = StatusResolver.getInstance();
const holidayService = HolidayService.getInstance();
const tracker = TrackerService.getInstance();

// Create MCP Server
export const mcpServer = new McpServer({
    name: "status-mcp",
    version: "1.0.0"
});

// Register tools

// status_get: Get resolved status for now or a specific date
mcpServer.tool(
    "status_get",
    "Get resolved status for now or a specific date",
    {
        date: z.string().describe("YYYY-MM-DD").optional()
    },
    async (args, _extra) => {
        let date = undefined;
        if (args.date) {
            date = new Date(args.date);
            if (isNaN(date.getTime())) {
                 return {
                    isError: true,
                    content: [{ type: "text", text: "Invalid date format. Use YYYY-MM-DD" }]
                 };
            }
        }
        const result = await resolver.resolveStatus(date);
        return {
            content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
        };
    }
);

// status_set_override: Set manual status override
mcpServer.tool(
    "status_set_override",
    "Set manual status override",
    {
        status: z.string(),
        reason: z.string().optional(),
        ttlSeconds: z.number().int().optional()
    },
    async (args, _extra) => {
        await tracker.setWorkStatus(args.status, args.reason, args.ttlSeconds);
        const result = await resolver.resolveStatus();
        return {
            content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
        };
    }
);

// status_get_work: Get only work status
mcpServer.tool(
    "status_get_work",
    "Get only work status",
    {
        date: z.string().describe("YYYY-MM-DD").optional()
    },
    async (args, _extra) => {
        let date = undefined;
        if (args.date) {
             date = new Date(args.date);
             if (isNaN(date.getTime())) {
                 return {
                    isError: true,
                    content: [{ type: "text", text: "Invalid date format. Use YYYY-MM-DD" }]
                 };
            }
        }
        const status = await resolver.resolveStatus(date);
        return {
            content: [{ type: "text", text: JSON.stringify({ workStatus: status.workStatus, effectiveDate: status.effectiveDate }, null, 2) }]
        };
    }
);

// status_set_work: Set manual work status override (alias/wrapper for set_override)
mcpServer.tool(
    "status_set_work",
    "Set manual work status override",
    {
        workStatus: z.string(),
        reason: z.string().optional(),
        ttlSeconds: z.number().int().optional()
    },
    async (args, _extra) => {
        await tracker.setWorkStatus(args.workStatus, args.reason, args.ttlSeconds);
        const status = await resolver.resolveStatus();
        return {
            content: [{ type: "text", text: JSON.stringify({ workStatus: status.workStatus, effectiveDate: status.effectiveDate }, null, 2) }]
        };
    }
);

// status_get_location: Get only location status
mcpServer.tool(
    "status_get_location",
    "Get only location status",
    {},
    async (_args, _extra) => {
        const status = await resolver.resolveStatus();
        return {
            content: [{ type: "text", text: JSON.stringify({ location: status.location, effectiveDate: status.effectiveDate }, null, 2) }]
        };
    }
);

// status_set_location: Set manual location
mcpServer.tool(
    "status_set_location",
    "Set manual location",
    {
        latitude: z.number(),
        longitude: z.number(),
        locationName: z.string().optional(),
        source: z.string().default('manual'),
        ttlSeconds: z.number().int().optional()
    },
    async (args, _extra) => {
        await tracker.setLocation(args.latitude, args.longitude, args.locationName, args.source, args.ttlSeconds);
        const status = await resolver.resolveStatus();
        return {
            content: [{ type: "text", text: JSON.stringify({ location: status.location, effectiveDate: status.effectiveDate }, null, 2) }]
        };
    }
);

// status_get_location_history: Get location history
mcpServer.tool(
    "status_get_location_history",
    "Get location history",
    {
        from: z.string().optional(),
        to: z.string().optional(),
        limit: z.number().int().optional()
    },
    async (args, _extra) => {
        let fromDate = undefined;
        let toDate = undefined;
        if (args.from) {
            fromDate = new Date(args.from);
             if (isNaN(fromDate.getTime())) {
                 return {
                    isError: true,
                    content: [{ type: "text", text: "Invalid from date" }]
                 };
            }
        }
        if (args.to) {
            toDate = new Date(args.to);
             if (isNaN(toDate.getTime())) {
                 return {
                    isError: true,
                    content: [{ type: "text", text: "Invalid to date" }]
                 };
            }
        }

        const events = await tracker.getLocationHistory(fromDate, toDate, args.limit);
        return {
            content: [{
                type: "text",
                text: JSON.stringify({
                    events: events.map(event => ({
                        latitude: event.latitude,
                        longitude: event.longitude,
                        locationName: event.name || undefined,
                        source: event.source,
                        timestamp: event.createdAt.toISOString()
                    }))
                }, null, 2)
            }]
        };
    }
);

// status_schedule_set: Set scheduled override
mcpServer.tool(
    "status_schedule_set",
    "Set scheduled override for a date",
    {
        date: z.string().describe("YYYY-MM-DD"),
        workStatus: z.string().optional(),
        location: z.object({
            latitude: z.number(),
            longitude: z.number(),
            locationName: z.string().optional()
        }).optional(),
        reason: z.string().optional()
    },
    async (args, _extra) => {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(args.date)) {
             return {
                isError: true,
                content: [{ type: "text", text: "Invalid date format. Use YYYY-MM-DD" }]
             };
        }
        await tracker.upsertSchedule(args.date, args.workStatus, args.location, args.reason);
        return {
            content: [{ type: "text", text: JSON.stringify({ success: true }, null, 2) }]
        };
    }
);

// status_schedule_list: List scheduled overrides
mcpServer.tool(
    "status_schedule_list",
    "List scheduled overrides",
    {
        from: z.string().optional(),
        to: z.string().optional()
    },
    async (args, _extra) => {
        const result = await tracker.listSchedules(args.from, args.to);
        return {
            content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
        };
    }
);

// status_schedule_delete: Delete scheduled override
mcpServer.tool(
    "status_schedule_delete",
    "Delete scheduled override",
    {
        date: z.string()
    },
    async (args, _extra) => {
        await tracker.deleteSchedule(args.date).catch(() => {}); // Ignore not found
        return {
            content: [{ type: "text", text: JSON.stringify({ success: true }, null, 2) }]
        };
    }
);

// holidays_list: List holidays
mcpServer.tool(
    "holidays_list",
    "List holidays for current year",
    {
        region: z.string().optional()
    },
    async (args, _extra) => {
        const result = await holidayService.fetchHolidays(args.region);
        return {
            content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
        };
    }
);

// HTTP Handler
export const handleMcpRequest = async (req: Request, res: Response) => {
    logger.info({ method: req.method, url: req.url }, "Handling MCP request");
    try {
        const transport = new StreamableHTTPServerTransport();
        await mcpServer.connect(transport);
        logger.debug("MCP server connected to transport");
        await transport.handleRequest(req, res, req.body);
    } catch (err) {
        logger.error({ err, requestId: getRequestId(req) }, "MCP Transport error");
        if (!res.headersSent) {
            res.status(500).json({ error: "Internal Server Error" });
        }
    }
};
