import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest';
import crypto from 'crypto';
import { getMasterKeyBytes } from '../../src/utils/masterKey';

describe('Master Key Derivation', () => {
    const originalEnv = process.env;

    beforeEach(() => {
        vi.resetModules();
        process.env = { ...originalEnv };
    });

    afterAll(() => {
        process.env = originalEnv;
    });

    it('should throw if MASTER_KEY is missing', () => {
        delete process.env.MASTER_KEY;
        expect(() => getMasterKeyBytes()).toThrow('MASTER_KEY environment variable is missing or empty');
    });

    it('should throw if MASTER_KEY is empty', () => {
        process.env.MASTER_KEY = '   ';
        expect(() => getMasterKeyBytes()).toThrow('MASTER_KEY environment variable is missing or empty');
    });

    it('should decode 64 hex characters to 32 bytes', () => {
        const hexKey = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
        process.env.MASTER_KEY = hexKey;
        const bytes = getMasterKeyBytes();
        expect(bytes.length).toBe(32);
        expect(bytes.toString('hex')).toBe(hexKey);
    });

    it('should derive 32 bytes from passphrase using SHA-256', () => {
        const passphrase = 'this is a strong passphrase';
        process.env.MASTER_KEY = passphrase;
        const bytes = getMasterKeyBytes();
        const expected = crypto.createHash('sha256').update(passphrase).digest();
        expect(bytes.length).toBe(32);
        expect(bytes).toEqual(expected);
    });

    it('should trim whitespace from hex keys', () => {
        const hexKey = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
        process.env.MASTER_KEY = `  ${hexKey}  `;
        const bytes = getMasterKeyBytes();
        expect(bytes.length).toBe(32);
        expect(bytes.toString('hex')).toBe(hexKey);
    });

    it('should trim whitespace from passphrases', () => {
        const passphrase = 'password';
        process.env.MASTER_KEY = '  password  ';
        const bytes = getMasterKeyBytes();
        const expected = crypto.createHash('sha256').update(passphrase).digest();
        expect(bytes).toEqual(expected);
    });
});
