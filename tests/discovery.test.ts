import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../src/index';

describe('SSE and Discovery Verification', () => {
    it('should return correct resource URL in OAuth discovery', async () => {
        const res = await request(app).get('/.well-known/oauth-protected-resource');
        expect(res.status).toBe(200);
        expect(res.body.resource).toMatch(/\/mcp$/);
    });

    it('should redirect SSE requests on root URL to /mcp', async () => {
        const res = await request(app)
            .get('/')
            .set('Accept', 'text/event-stream');

        expect(res.status).toBe(302);
        expect(res.headers.location).toBe('/mcp');
    });

    it('should return HTML for normal requests on root URL', async () => {
        const res = await request(app).get('/');
        expect(res.status).toBe(200);
        expect(res.header['content-type']).toContain('text/html');
    });
});
