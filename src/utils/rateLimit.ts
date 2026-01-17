import { createLogger } from '../logger';

const logger = createLogger('utils:rateLimit');

interface RateLimitEntry {
    count: number;
    resetAt: number;
}

export class RateLimiter {
    private limits = new Map<string, RateLimitEntry>();
    private cleanupTimer: NodeJS.Timeout | null = null;

    constructor(
        private windowSeconds: number,
        private limit: number,
        private _cleanupIntervalSeconds: number = 600
    ) {
        // Periodic cleanup of expired entries
        if (this._cleanupIntervalSeconds > 0) {
            this.startCleanup();
        }
    }

    /**
     * Check if action is allowed for key. Returns true if allowed.
     * Increments count if allowed.
     */
    public check(key: string): boolean {
        const now = Date.now();
        let entry = this.limits.get(key);

        if (!entry || entry.resetAt < now) {
            entry = { count: 0, resetAt: now + this.windowSeconds * 1000 };
            this.limits.set(key, entry);
        }

        if (entry.count >= this.limit) {
            logger.warn({ key: key.slice(0, 8) + '...' }, 'Rate limit exceeded');
            return false;
        }

        entry.count++;
        return true;
    }

    private cleanup() {
        const now = Date.now();
        for (const [key, entry] of this.limits.entries()) {
            if (entry.resetAt < now) {
                this.limits.delete(key);
            }
        }
    }

    public stopCleanup(): void {
        if (!this.cleanupTimer) return;
        clearInterval(this.cleanupTimer);
        this.cleanupTimer = null;
    }

    private startCleanup(): void {
        this.cleanupTimer = setInterval(() => this.cleanup(), this._cleanupIntervalSeconds * 1000);
    }
}

// Global instances
// Issue: 3 per hour
export const issueRateLimiter = new RateLimiter(
    parseInt(process.env.API_KEY_ISSUE_WINDOW_SECONDS || '3600'),
    parseInt(process.env.API_KEY_ISSUE_RATELIMIT || '3')
);

// MCP Use: 60 per minute per key
export const mcpRateLimiter = new RateLimiter(
    parseInt(process.env.MCP_RATELIMIT_WINDOW_SECONDS || '60'),
    parseInt(process.env.MCP_RATELIMIT_PER_KEY || '60')
);
