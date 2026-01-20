import { Request } from 'express';

/**
 * Normalizes the Accept header for MCP requests.
 * Defaults to 'application/json' if missing or set to wildcard.
 */
export function normalizeAcceptHeader(req: Request): void {
    const accept = req.headers.accept;
    if (!accept || accept === '*/*') {
        req.headers.accept = 'application/json, text/event-stream';
    }
}
