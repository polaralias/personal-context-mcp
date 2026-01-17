import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import prisma from '../db';
import { createLogger } from '../logger';
import { getMasterKeyBytes } from '../utils/masterKey';

const ALGORITHM = 'aes-256-gcm';
const logger = createLogger('services:auth');

const getErrorMessage = (error: unknown): string =>
    error instanceof Error ? error.message : 'Unknown error';

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
        const key = getMasterKeyBytes();
        const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
        decipher.setAuthTag(authTag);
        let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        return JSON.parse(decrypted);
    } catch (primaryError) {
        // Fallback for legacy key derivation (padding/truncating)
        // Explicitly handle "insecure-master-key-must-be-32-bytes-long" case or any key that was processed differently

        let rawKey = process.env.MASTER_KEY || '';
        let legacyKey: Buffer;

        if (rawKey.length < 32) {
            legacyKey = Buffer.from(rawKey.padEnd(32, '0'));
        } else if (rawKey.length > 32) {
            legacyKey = Buffer.from(rawKey.substring(0, 32));
        } else {
             // If exactly 32 but failed, it might have been treated as bytes directly vs utf8
             legacyKey = Buffer.from(rawKey);
        }

        try {
            const decipher = crypto.createDecipheriv(ALGORITHM, legacyKey, iv);
            decipher.setAuthTag(authTag);
            let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
            decrypted += decipher.final('utf8');
            logger.warn({ err: getErrorMessage(primaryError) }, 'Primary decrypt failed; using legacy key derivation');
            return JSON.parse(decrypted);
        } catch (legacyError) {
            throw new Error(
                `Failed to decrypt config (primary: ${getErrorMessage(primaryError)}; legacy: ${getErrorMessage(legacyError)})`
            );
        }
    }
};

// --- Connection Operations ---

export const createConnection = async (name: string | null, publicConfig: any, secretConfig: any) => {
    return prisma.connection.create({
        data: {
            name,
            config: publicConfig,
            encryptedSecrets: encryptConfig(secretConfig)
        }
    });
};

export const getConnection = async (connectionId: string) => {
    return prisma.connection.findUnique({
        where: { id: connectionId }
    });
};

// --- Auth Code Operations ---

export const createAuthCode = async (
    connectionId: string,
    redirectUri: string,
    state: string | undefined,
    codeChallenge: string,
    codeChallengeMethod: string,
    clientId: string
) => {
    const rawCode = crypto.randomBytes(32).toString('hex');
    const codeHash = hashString(rawCode);
    const expiresAt = new Date(Date.now() + (parseInt(process.env.CODE_TTL_SECONDS || '90') * 1000));

    await prisma.authCode.create({
        data: {
            code: codeHash,
            connectionId,
            redirectUri,
            state,
            codeChallenge,
            codeChallengeMethod,
            expiresAt,
            clientId
        }
    });

    return rawCode;
};

export const findAndValidateAuthCode = async (rawCode: string) => {
    const codeHash = hashString(rawCode);
    const authCode = await prisma.authCode.findUnique({
        where: { code: codeHash },
        include: { connection: true }
    });

    if (!authCode) return null;
    if (authCode.expiresAt < new Date()) return null;

    return authCode;
};

export const markAuthCodeUsed = async (rawCodeHash: string) => {
    // Requirements say "Deletes auth code (one-time use)".
    // So we delete it.
    return prisma.authCode.delete({
        where: { code: rawCodeHash }
    });
};

// --- Session Operations ---

export const createSession = async (connectionId: string) => {
    const rawToken = crypto.randomBytes(32).toString('hex'); // Access token secret
    const sessionId = crypto.randomUUID();

    // Requirements: "Stores bcrypt hash of secret in sessions.token_hash"
    const tokenHash = await bcrypt.hash(rawToken, 10);

    const expiresAt = new Date(Date.now() + (parseInt(process.env.TOKEN_TTL_SECONDS || '3600') * 1000));

    await prisma.session.create({
        data: {
            id: sessionId,
            connectionId,
            tokenHash,
            expiresAt
        }
    });

    return {
        accessToken: `${sessionId}:${rawToken}`,
        expiresIn: parseInt(process.env.TOKEN_TTL_SECONDS || '3600')
    };
};

// --- Client Operations ---

export const createClient = async (
    clientName: string | undefined,
    redirectUris: string[]
) => {
    return prisma.client.create({
        data: {
            clientName,
            redirectUris: redirectUris,
        }
    });
};

export const getClient = async (clientId: string) => {
    return prisma.client.findUnique({
        where: { clientId }
    });
};

// --- User Config (API Key) Operations ---

export const createUserBoundKey = async (config: any) => {
    // Encrypt config
    const configEnc = encryptConfig(config);

    // Create User Config
    const userConfig = await prisma.userConfig.create({
        data: {
            serverId: 'default',
            configEnc
        }
    });

    // Generate Key
    const rawKey = `mcp_sk_${crypto.randomBytes(32).toString('hex')}`;
    const keyHash = hashString(rawKey);

    await prisma.apiKey.create({
        data: {
            userConfigId: userConfig.id,
            keyHash
        }
    });

    return rawKey;
};

export const validateApiKey = (apiKey: string): boolean => {
    const keys: string[] = [];
    if (process.env.MCP_API_KEY) {
        keys.push(process.env.MCP_API_KEY);
    }
    if (process.env.MCP_API_KEYS) {
        keys.push(...process.env.MCP_API_KEYS.split(',').map(k => k.trim()));
    }

    if (keys.length === 0) return false;

    // Use timingSafeEqual to prevent timing attacks
    const providedKey = Buffer.from(apiKey);

    for (const key of keys) {
        const storedKey = Buffer.from(key);
        if (providedKey.length === storedKey.length && crypto.timingSafeEqual(providedKey, storedKey)) {
            return true;
        }
    }

    return false;
};
