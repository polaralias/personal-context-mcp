import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest';
import crypto from 'crypto';
import { encryptConfig, decryptConfig } from '../../src/services/auth';

describe('Encryption Round-trip and Fallback', () => {
    const originalEnv = process.env;

    beforeEach(() => {
        vi.resetModules();
        process.env = { ...originalEnv };
    });

    afterAll(() => {
        process.env = originalEnv;
    });

    const testConfig = { foo: 'bar', secret: '12345' };

    it('should work with 64-hex MASTER_KEY', () => {
        process.env.MASTER_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
        const encrypted = encryptConfig(testConfig);
        const decrypted = decryptConfig(encrypted);
        expect(decrypted).toEqual(testConfig);
    });

    it('should work with passphrase MASTER_KEY', () => {
        process.env.MASTER_KEY = 'a-very-secret-passphrase';
        const encrypted = encryptConfig(testConfig);
        const decrypted = decryptConfig(encrypted);
        expect(decrypted).toEqual(testConfig);
    });

    it('should fallback to legacy decryption (padding)', () => {
        const shortKey = 'short-key';
        process.env.MASTER_KEY = shortKey;

        // Manual legacy encryption (padding with '0' to 32 bytes)
        const legacyKey = Buffer.from(shortKey.padEnd(32, '0'));
        const iv = crypto.randomBytes(16);
        const cipher = crypto.createCipheriv('aes-256-gcm', legacyKey, iv);
        let encrypted = cipher.update(JSON.stringify(testConfig), 'utf8', 'hex');
        encrypted += cipher.final('hex');
        const authTag = cipher.getAuthTag().toString('hex');
        const legacyEncryptedString = `${iv.toString('hex')}:${authTag}:${encrypted}`;

        // Attempt to decrypt with standardized logic (which will try SHA-256 first, then legacy padding)
        const decrypted = decryptConfig(legacyEncryptedString);
        expect(decrypted).toEqual(testConfig);
    });

    it('should fallback to legacy decryption (truncation)', () => {
        const longKey = 'this-is-a-very-long-key-that-is-longer-than-32-characters';
        process.env.MASTER_KEY = longKey;

        // Manual legacy encryption (truncation to 32 bytes)
        const legacyKey = Buffer.from(longKey.substring(0, 32));
        const iv = crypto.randomBytes(16);
        const cipher = crypto.createCipheriv('aes-256-gcm', legacyKey, iv);
        let encrypted = cipher.update(JSON.stringify(testConfig), 'utf8', 'hex');
        encrypted += cipher.final('hex');
        const authTag = cipher.getAuthTag().toString('hex');
        const legacyEncryptedString = `${iv.toString('hex')}:${authTag}:${encrypted}`;

        // Attempt to decrypt with standardized logic
        const decrypted = decryptConfig(legacyEncryptedString);
        expect(decrypted).toEqual(testConfig);
    });
});
