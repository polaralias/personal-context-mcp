import crypto from 'crypto';
import prisma from '../db';

import { getMasterKeyBytes } from '../utils/masterKey';

const ALGORITHM = 'aes-256-gcm';

// Legacy derivation helper for fallback decryption
const getLegacyKey = () => {
    let key = process.env.MASTER_KEY || 'insecure-master-key-must-be-32-bytes-long';
    if (key.length < 32) {
        key = key.padEnd(32, '0');
    } else if (key.length > 32) {
        key = key.substring(0, 32);
    }
    return Buffer.from(key);
};

// --- Crypto Helpers ---

export const hashString = (input: string): string => {
    return crypto.createHash('sha256').update(input).digest('hex');
};

export const verifyPkce = (verifier: string, challenge: string, method: string): boolean => {
    if (method !== 'S256') return false;
    const hash = crypto.createHash('sha256').update(verifier).digest('base64url');
    return hash === challenge;
};

export const encryptConfig = (config: any): string => {
    const key = getMasterKeyBytes();
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    let encrypted = cipher.update(JSON.stringify(config), 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag().toString('hex');
    // Format: iv:authTag:encrypted
    return `${iv.toString('hex')}:${authTag}:${encrypted}`;
};

export const decryptConfig = (encryptedString: string): any => {
    const parts = encryptedString.split(':');
    if (parts.length !== 3) throw new Error('Invalid encrypted string format');

    const [ivHex, authTagHex, encryptedHex] = parts;
    if (!ivHex || !authTagHex || !encryptedHex) throw new Error('Invalid encrypted string format');

    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');

    try {
        // Try with new standardized key first
        const key = getMasterKeyBytes();
        const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
        decipher.setAuthTag(authTag);

        let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        return JSON.parse(decrypted);
    } catch (error) {
        // Fallback to legacy key derivation
        try {
            const legacyKey = getLegacyKey();
            const decipher = crypto.createDecipheriv(ALGORITHM, legacyKey, iv);
            decipher.setAuthTag(authTag);

            let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
            decrypted += decipher.final('utf8');

            console.warn('SUCCESS: Decrypted using legacy key derivation. Config should be re-saved to upgrade encryption.');
            return JSON.parse(decrypted);
        } catch (legacyError) {
            throw new Error('Failed to decrypt config with both standardized and legacy keys');
        }
    }
};


// --- JWT Helpers ---

export const signToken = (connectionId: string): string => {
    // Simple JWT implementation without external lib if preferred, but existing code might not use jsonwebtoken.
    // Given the prompt says "Access tokens may be JWT or opaque", and "If using JWTs, token persistence is optional."
    // I will implement a basic JWT signing using crypto (HS256) and MASTER_KEY.

    const header = { alg: 'HS256', typ: 'JWT' };
    const payload = {
        sub: connectionId,
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + (parseInt(process.env.TOKEN_TTL_SECONDS || '3600'))
    };

    const encode = (obj: any) => Buffer.from(JSON.stringify(obj)).toString('base64url');
    const signatureInput = `${encode(header)}.${encode(payload)}`;
    const signature = crypto.createHmac('sha256', getMasterKeyBytes()).update(signatureInput).digest('base64url');

    return `${signatureInput}.${signature}`;
};

export const verifyToken = (token: string): string | null => {
    try {
        const [headerB64, payloadB64, signature] = token.split('.');
        if (!headerB64 || !payloadB64 || !signature) return null;

        const signatureInput = `${headerB64}.${payloadB64}`;
        const expectedSignature = crypto.createHmac('sha256', getMasterKeyBytes()).update(signatureInput).digest('base64url');

        if (signature !== expectedSignature) return null;

        const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString());
        if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return null;

        return payload.sub;
    } catch (e) {
        return null;
    }
};

// --- DB Operations ---

export const createConnection = async (displayName: string | null, config: any) => {
    return prisma.connection.create({
        data: {
            displayName,
            configEncrypted: encryptConfig(config),
            configVersion: 1
        }
    });
};

export const createAuthCode = async (
    connectionId: string,
    redirectUri: string,
    state: string,
    codeChallenge: string,
    codeChallengeMethod: string
) => {
    const code = crypto.randomBytes(32).toString('hex');
    const codeHash = hashString(code);
    const expiresAt = new Date(Date.now() + (parseInt(process.env.CODE_TTL_SECONDS || '90') * 1000));

    await prisma.authCode.create({
        data: {
            codeHash,
            connectionId,
            redirectUri,
            state,
            codeChallenge,
            codeChallengeMethod,
            expiresAt
        }
    });

    return code;
};

export const findAndValidateAuthCode = async (code: string) => {
    const codeHash = hashString(code);
    const authCode = await prisma.authCode.findUnique({
        where: { codeHash },
        include: { connection: true }
    });

    if (!authCode) return null;
    if (authCode.usedAt) return null;
    if (authCode.expiresAt < new Date()) return null;

    return authCode;
};

export const markAuthCodeUsed = async (id: number) => {
    return prisma.authCode.update({
        where: { id },
        data: { usedAt: new Date() }
    });
};

export const getConnection = async (connectionId: string) => {
    return prisma.connection.findUnique({
        where: { id: connectionId }
    });
};
