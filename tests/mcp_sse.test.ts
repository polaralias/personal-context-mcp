import { describe, it, expect } from 'vitest';
import { normalizeAcceptHeader } from '../src/utils/mcpUtils';

describe('normalizeAcceptHeader', () => {
    it('should default to application/json when Accept header is missing', () => {
        const req = {
            headers: {}
        } as any;
        normalizeAcceptHeader(req);
        expect(req.headers.accept).toBe('application/json');
    });

    it('should default to application/json when Accept header is */*', () => {
        const req = {
            headers: {
                accept: '*/*'
            }
        } as any;
        normalizeAcceptHeader(req);
        expect(req.headers.accept).toBe('application/json');
    });

    it('should preserve text/event-stream if it is explicitly requested', () => {
        const req = {
            headers: {
                accept: 'text/event-stream'
            }
        } as any;
        normalizeAcceptHeader(req);
        expect(req.headers.accept).toBe('text/event-stream');
    });

    it('should preserve multiple accept types including text/event-stream', () => {
        const req = {
            headers: {
                accept: 'application/json, text/event-stream'
            }
        } as any;
        normalizeAcceptHeader(req);
        expect(req.headers.accept).toBe('application/json, text/event-stream');
    });
});
