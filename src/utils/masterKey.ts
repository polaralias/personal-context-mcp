import crypto from 'crypto';

const INSECURE_DEFAULT = 'insecure-master-key-must-be-32-bytes-long';

/**
 * Checks if MASTER_KEY is configured.
 */
export function hasMasterKey(): boolean {
    const key = process.env.MASTER_KEY;
    return !!(key && key.trim() !== '');
}

/**
 * Standardized MASTER_KEY handling.
 * 1. If 64 hex characters, treat as 32 bytes of key material.
 * 2. Otherwise, treat as passphrase and derive 32-byte key using SHA-256.
 * 
 * Throws if MASTER_KEY is missing or empty.
 */
export function getMasterKeyBytes(): Buffer {
    let key = process.env.MASTER_KEY;

    if (!key || key.trim() === '') {
        throw new Error('MASTER_KEY environment variable is missing or empty. Server must fail fast.');
    }

    key = key.trim();

    if (key === INSECURE_DEFAULT) {
        console.warn('WARNING: Using an insecure default MASTER_KEY. This is only acceptable for local development examples.');
    }

    // Check if it's 64 hex characters (32 bytes)
    if (/^[0-9a-fA-F]{64}$/.test(key)) {
        return Buffer.from(key, 'hex');
    }

    // Otherwise, treat as passphrase and derive using SHA-256
    return crypto.createHash('sha256').update(key, 'utf8').digest();
}

/**
 * Returns diagnostic info about the key (never the key itself).
 */
export function getMasterKeyInfo() {
    try {
        if (!hasMasterKey()) {
            return { status: 'missing' };
        }
        const bytes = getMasterKeyBytes();
        const key = process.env.MASTER_KEY?.trim() || '';
        const isHex = /^[0-9a-fA-F]{64}$/.test(key);

        return {
            status: 'present',
            length: bytes.length,
            derivation: isHex ? 'hex-decode' : 'sha256',
            isInsecureDefault: key === INSECURE_DEFAULT
        };
    } catch (error: any) {
        return {
            status: 'error',
            error: error.message
        };
    }
}

