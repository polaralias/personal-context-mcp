import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../src/index';

describe('Well-Known Endpoints Verification', () => {
    describe('GET /.well-known/mcp', () => {
        it('should return mcp_endpoint, config_endpoint, and oauth_protected_resource', async () => {
            const res = await request(app).get('/.well-known/mcp');
            expect(res.status).toBe(200);
            expect(res.body.mcp_endpoint).toBeDefined();
            expect(res.body.config_endpoint).toBeDefined();
            expect(res.body.oauth_protected_resource).toBeDefined();
            expect(res.body.mcp_endpoint).toContain('/mcp');
            expect(res.body.config_endpoint).toContain('/.well-known/mcp-config');
            expect(res.body.oauth_protected_resource).toContain('/.well-known/oauth-protected-resource');
        });
    });

    describe('GET /.well-known/mcp-config', () => {
        it('should return the config schema with fields', async () => {
            const res = await request(app).get('/.well-known/mcp-config');
            expect(res.status).toBe(200);
            expect(res.body.fields).toBeInstanceOf(Array);
            expect(res.body.fields.length).toBeGreaterThan(0);
        });
    });

    describe('GET /.well-known/oauth-protected-resource', () => {
        it('should return resource and authorization_servers', async () => {
            const res = await request(app).get('/.well-known/oauth-protected-resource');
            expect(res.status).toBe(200);
            expect(res.body.resource).toBeDefined();
            expect(res.body.authorization_servers).toBeInstanceOf(Array);
            expect(res.body.authorization_servers.length).toBeGreaterThan(0);
        });
    });

    describe('GET /.well-known/oauth-authorization-server', () => {
        it('should return all required authorization server metadata', async () => {
            const res = await request(app).get('/.well-known/oauth-authorization-server');
            expect(res.status).toBe(200);
            expect(res.body.issuer).toBeDefined();
            expect(res.body.authorization_endpoint).toBeDefined();
            expect(res.body.token_endpoint).toBeDefined();
            expect(res.body.registration_endpoint).toBeDefined();
            expect(res.body.response_types_supported).toContain('code');
            expect(res.body.grant_types_supported).toContain('authorization_code');
        });
    });
});
