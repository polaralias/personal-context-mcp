import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { isRedirectUriAllowed } from '../src/utils/redirectUri';

describe('isRedirectUriAllowed', () => {
    const originalEnv = process.env;

    beforeEach(() => {
        process.env = { ...originalEnv };
    });

    afterEach(() => {
        process.env = originalEnv;
    });

    describe('when allowlist is empty', () => {
        it('should allow any valid URL', () => {
            process.env.REDIRECT_URI_ALLOWLIST = '';
            
            expect(isRedirectUriAllowed('https://example.com/callback')).toBe(true);
            expect(isRedirectUriAllowed('http://localhost:3000')).toBe(true);
        });
    });

    describe('when allowlist is set (exact match)', () => {
        beforeEach(() => {
            process.env.REDIRECT_URI_ALLOWLIST = 'https://example.com/callback,http://localhost:3010';
            delete process.env.REDIRECT_URI_ALLOWLIST_MODE;
        });

        it('should allow exact URI match', () => {
            expect(isRedirectUriAllowed('https://example.com/callback')).toBe(true);
            expect(isRedirectUriAllowed('http://localhost:3010')).toBe(true);
        });

        it('should reject non-matching URIs', () => {
            expect(isRedirectUriAllowed('https://example.com/')).toBe(false);
            expect(isRedirectUriAllowed('https://app.example.com/callback')).toBe(false);
        });
    });

    describe('protocol validation', () => {
        beforeEach(() => {
            process.env.REDIRECT_URI_ALLOWLIST = 'https://example.com';
            delete process.env.REDIRECT_URI_ALLOWLIST_MODE;
        });

        it('should reject non-http/https protocols', () => {
            expect(isRedirectUriAllowed('javascript:alert(1)')).toBe(false);
            expect(isRedirectUriAllowed('file:///etc/passwd')).toBe(false);
            expect(isRedirectUriAllowed('data:text/html,<script>')).toBe(false);
        });

        it('should allow http protocol', () => {
            process.env.REDIRECT_URI_ALLOWLIST = 'http://localhost:3010/callback';
            expect(isRedirectUriAllowed('http://localhost:3010/callback')).toBe(true);
        });

        it('should allow https protocol', () => {
            process.env.REDIRECT_URI_ALLOWLIST = 'https://example.com/callback';
            expect(isRedirectUriAllowed('https://example.com/callback')).toBe(true);
        });
    });

    describe('malformed URLs', () => {
        it('should reject invalid URLs', () => {
            expect(isRedirectUriAllowed('not-a-url')).toBe(false);
            expect(isRedirectUriAllowed('')).toBe(false);
            expect(isRedirectUriAllowed('://missing-scheme. com')).toBe(false);
        });
    });

    describe('case sensitivity', () => {
        beforeEach(() => {
            process.env.REDIRECT_URI_ALLOWLIST = 'https://Example.COM';
            process.env.REDIRECT_URI_ALLOWLIST_MODE = 'prefix';
        });

        it('should be case-insensitive for hostname', () => {
            expect(isRedirectUriAllowed('https://example.com/callback')).toBe(true);
            expect(isRedirectUriAllowed('https://EXAMPLE.COM/callback')).toBe(true);
        });
    });

    describe('allowlist with various formats', () => {
        it('should handle allowlist entries with paths (exact)', () => {
            process.env.REDIRECT_URI_ALLOWLIST = 'https://example.com/specific/path';
            delete process.env.REDIRECT_URI_ALLOWLIST_MODE;
            expect(isRedirectUriAllowed('https://example.com/specific/path')).toBe(true);
            expect(isRedirectUriAllowed('https://example.com/different/path')).toBe(false);
        });

        it('should handle allowlist entries with ports (exact)', () => {
            process.env.REDIRECT_URI_ALLOWLIST = 'http://localhost:3010/callback';
            delete process.env.REDIRECT_URI_ALLOWLIST_MODE;
            expect(isRedirectUriAllowed('http://localhost:3010/callback')).toBe(true);
            // Different port should fail
            expect(isRedirectUriAllowed('http://localhost:3000/callback')).toBe(false);
        });

        it('should handle whitespace in allowlist', () => {
            process.env.REDIRECT_URI_ALLOWLIST = '  https://example.com/callback  ,  http://localhost:3010  ';
            expect(isRedirectUriAllowed('https://example.com/callback')).toBe(true);
        });
    });

    describe('when allowlist is set (prefix mode)', () => {
        beforeEach(() => {
            process.env.REDIRECT_URI_ALLOWLIST = 'https://example.com,http://localhost:3010';
            process.env.REDIRECT_URI_ALLOWLIST_MODE = 'prefix';
        });

        it('should allow hostname and subdomain match', () => {
            expect(isRedirectUriAllowed('https://example.com/callback')).toBe(true);
            expect(isRedirectUriAllowed('https://app.example.com/callback')).toBe(true);
            expect(isRedirectUriAllowed('https://api.app.example.com/callback')).toBe(true);
        });

        it('should reject non-matching hostname', () => {
            expect(isRedirectUriAllowed('https://evil.com/callback')).toBe(false);
            expect(isRedirectUriAllowed('https://notexample.com/callback')).toBe(false);
        });

        it('should reject hostname that only contains allowed as prefix', () => {
            expect(isRedirectUriAllowed('https://example.com.evil.com/callback')).toBe(false);
        });
    });
});
