import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import crypto from 'crypto';

describe('encryptConfig / decryptConfig', () => {
    const originalEnv = process.env;

    beforeEach(() => {
        process.env = { ... originalEnv };
    });

    afterEach(() => {
        process.env = originalEnv;
    });

    // We need to re-import after changing env
    const getAuthModule = async () => {
        // Clear module cache
        vi.resetModules();
        return await import('../src/services/auth');
    };

    describe('with hex MASTER_KEY (64 chars)', () => {
        const hexKey = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

        it('should encrypt and decrypt successfully', async () => {
            process.env.MASTER_KEY = hexKey;
            const { encryptConfig, decryptConfig } = await getAuthModule();

            const original = { apiKey: 'test-key', nested: { value: 123 } };
            const encrypted = encryptConfig(original);
            const decrypted = decryptConfig(encrypted);

            expect(decrypted).toEqual(original);
        });

        it('should produce different ciphertext for same plaintext (random IV)', async () => {
            process.env.MASTER_KEY = hexKey;
            const { encryptConfig } = await getAuthModule();

            const original = { key: 'value' };
            const encrypted1 = encryptConfig(original);
            const encrypted2 = encryptConfig(original);

            expect(encrypted1).not.toBe(encrypted2);
        });
    });

    describe('with passphrase MASTER_KEY', () => {
        it('should encrypt and decrypt successfully', async () => {
            process.env.MASTER_KEY = 'my-secure-passphrase';
            const { encryptConfig, decryptConfig } = await getAuthModule();

            const original = { secret: 'data' };
            const encrypted = encryptConfig(original);
            const decrypted = decryptConfig(encrypted);

            expect(decrypted).toEqual(original);
        });
    });

    describe('with insecure default MASTER_KEY', () => {
        it('should work with the docker-compose default', async () => {
            process.env.MASTER_KEY = 'insecure-master-key-must-be-32-bytes-long';
            const { encryptConfig, decryptConfig } = await getAuthModule();

            const original = { test: true };
            const encrypted = encryptConfig(original);
            const decrypted = decryptConfig(encrypted);

            expect(decrypted).toEqual(original);
        });
    });

    describe('error cases', () => {
        it('should throw for invalid encrypted string format', async () => {
            process.env.MASTER_KEY = 'test-key';
            const { decryptConfig } = await getAuthModule();

            expect(() => decryptConfig('invalid')).toThrow('Invalid encrypted string format');
            expect(() => decryptConfig('a: b')).toThrow('Invalid encrypted string format');
            expect(() => decryptConfig('')).toThrow();
        });

        it('should throw for tampered ciphertext', async () => {
            process.env.MASTER_KEY = 'test-key';
            const { encryptConfig, decryptConfig } = await getAuthModule();

            const encrypted = encryptConfig({ data: 'test' });
            const parts = encrypted.split(':');
            parts[2] = 'tampered' + parts[2]; // Corrupt the ciphertext
            const tampered = parts.join(':');

            expect(() => decryptConfig(tampered)).toThrow();
        });

        it('should throw for wrong MASTER_KEY', async () => {
            process.env.MASTER_KEY = 'original-key';
            const { encryptConfig } = await getAuthModule();
            const encrypted = encryptConfig({ data: 'test' });

            // Change key and try to decrypt
            process.env.MASTER_KEY = 'different-key';
            vi.resetModules();
            const { decryptConfig } = await import('../src/services/auth');

            expect(() => decryptConfig(encrypted)).toThrow('Failed to decrypt config');
        });
    });

    describe('legacy fallback', () => {
        it('should decrypt data encrypted with legacy key derivation', async () => {
            // Simulate legacy encryption (32-char key padded/truncated)
            const legacyKey = 'short-key'.padEnd(32, '0');
            const iv = crypto.randomBytes(16);
            const cipher = crypto.createCipheriv('aes-256-gcm', Buffer.from(legacyKey), iv);
            
            const original = { legacy: 'data' };
            let encrypted = cipher.update(JSON.stringify(original), 'utf8', 'hex');
            encrypted += cipher.final('hex');
            const authTag = cipher.getAuthTag().toString('hex');
            const legacyEncrypted = `${iv.toString('hex')}:${authTag}:${encrypted}`;

            // Now try to decrypt with the same raw key
            process.env.MASTER_KEY = 'short-key';
            const { decryptConfig } = await getAuthModule();

            const decrypted = decryptConfig(legacyEncrypted);
            expect(decrypted).toEqual(original);
        });
    });
});
