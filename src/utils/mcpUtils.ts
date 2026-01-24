import { Request } from 'express';

/**
 * Normalizes the Accept header for MCP requests.
 * Defaults to 'application/json' if missing or set to wildcard.
 */
export function normalizeAcceptHeader(req: Request): void {
    const accept = req.headers.accept;
    // Only default to application/json if missing or wildcard.
    // Do NOT force text/event-stream unless the client explicitly supports it.
    if (!accept || accept === '*/*') {
        req.headers.accept = 'application/json';
    }
}
