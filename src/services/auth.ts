import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import db from '../db';
import { authCodes, clients, connections, sessions, userConfigs, apiKeys } from '../db/schema';
import { eq } from 'drizzle-orm';
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
    const now = new Date();
    const connectionId = crypto.randomUUID();
    const encryptedSecrets = encryptConfig(secretConfig);

    db.insert(connections).values({
        id: connectionId,
        name,
        config: publicConfig ?? null,
        encryptedSecrets,
        createdAt: now,
        updatedAt: now
    }).run();

    return {
        id: connectionId,
        name,
        config: publicConfig ?? null,
        encryptedSecrets,
        createdAt: now,
        updatedAt: now
    };
};

export const getConnection = async (connectionId: string) => {
    return db.select().from(connections).where(eq(connections.id, connectionId)).get();
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
    const now = new Date();

    db.insert(authCodes).values({
        code: codeHash,
        connectionId,
        redirectUri,
        state: state ?? null,
        codeChallenge,
        codeChallengeMethod,
        expiresAt,
        createdAt: now,
        clientId
    }).run();

    return rawCode;
};

export const findAndValidateAuthCode = async (rawCode: string) => {
    const codeHash = hashString(rawCode);
    const authCode = db.select().from(authCodes).where(eq(authCodes.code, codeHash)).get();

    if (!authCode) return null;
    if (authCode.expiresAt < new Date()) return null;

    return authCode;
};

export const markAuthCodeUsed = async (rawCodeHash: string) => {
    // Requirements say "Deletes auth code (one-time use)".
    // So we delete it.
    return db.delete(authCodes).where(eq(authCodes.code, rawCodeHash)).run();
};

// --- Session Operations ---

export const createSession = async (connectionId: string) => {
    const rawToken = crypto.randomBytes(32).toString('hex'); // Access token secret
    const sessionId = crypto.randomUUID();

    // Requirements: "Stores bcrypt hash of secret in sessions.token_hash"
    const tokenHash = await bcrypt.hash(rawToken, 10);

    const expiresAt = new Date(Date.now() + (parseInt(process.env.TOKEN_TTL_SECONDS || '3600') * 1000));
    const now = new Date();

    db.insert(sessions).values({
        id: sessionId,
        connectionId,
        tokenHash,
        expiresAt,
        revoked: false,
        createdAt: now
    }).run();

    return {
        accessToken: `${sessionId}:${rawToken}`,
        expiresIn: parseInt(process.env.TOKEN_TTL_SECONDS || '3600')
    };
};

export const createSessionFromAuthCode = async (authCode: { code: string; connectionId: string }) => {
    const rawToken = crypto.randomBytes(32).toString('hex');
    const sessionId = crypto.randomUUID();
    const tokenHash = await bcrypt.hash(rawToken, 10);
    const expiresAt = new Date(Date.now() + (parseInt(process.env.TOKEN_TTL_SECONDS || '3600') * 1000));
    const now = new Date();

    db.transaction((tx) => {
        tx.delete(authCodes).where(eq(authCodes.code, authCode.code)).run();
        tx.insert(sessions).values({
            id: sessionId,
            connectionId: authCode.connectionId,
            tokenHash,
            expiresAt,
            revoked: false,
            createdAt: now
        }).run();
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
    const now = new Date();
    const clientId = crypto.randomUUID();

    db.transaction((tx) => {
        tx.insert(clients).values({
            clientId,
            clientName: clientName ?? null,
            redirectUris,
            tokenEndpointAuthMethod: 'none',
            grantTypes: [],
            responseTypes: [],
            scope: null,
            createdAt: now,
            updatedAt: now
        }).run();
    });

    return {
        clientId,
        clientName: clientName ?? null,
        redirectUris,
        tokenEndpointAuthMethod: 'none',
        grantTypes: [],
        responseTypes: [],
        scope: null,
        createdAt: now,
        updatedAt: now
    };
};

export const getClient = async (clientId: string) => {
    return db.select().from(clients).where(eq(clients.clientId, clientId)).get();
};

// --- User Config (API Key) Operations ---

export const createUserBoundKey = async (config: any) => {
    // Encrypt config
    const configEnc = encryptConfig(config);

    // Create User Config
    const now = new Date();
    const userConfigId = crypto.randomUUID();

    // Generate Key
    const rawKey = `mcp_sk_${crypto.randomBytes(32).toString('hex')}`;
    const keyHash = hashString(rawKey);

    db.transaction((tx) => {
        tx.insert(userConfigs).values({
            id: userConfigId,
            serverId: 'default',
            configEnc,
            configFingerprint: null,
            createdAt: now,
            updatedAt: now
        }).run();

        tx.insert(apiKeys).values({
            id: crypto.randomUUID(),
            userConfigId,
            keyHash,
            createdAt: now
        }).run();
    });

    return rawKey;
};

export const createConnectionWithAuthCode = async (
    name: string | null,
    publicConfig: any,
    secretConfig: any,
    redirectUri: string,
    state: string | undefined,
    codeChallenge: string,
    codeChallengeMethod: string,
    clientId: string
) => {
    const now = new Date();
    const connectionId = crypto.randomUUID();
    const encryptedSecrets = encryptConfig(secretConfig);
    const rawCode = crypto.randomBytes(32).toString('hex');
    const codeHash = hashString(rawCode);
    const expiresAt = new Date(Date.now() + (parseInt(process.env.CODE_TTL_SECONDS || '90') * 1000));

    db.transaction((tx) => {
        tx.insert(connections).values({
            id: connectionId,
            name,
            config: publicConfig ?? null,
            encryptedSecrets,
            createdAt: now,
            updatedAt: now
        }).run();

        tx.insert(authCodes).values({
            code: codeHash,
            connectionId,
            redirectUri,
            state: state ?? null,
            clientId,
            codeChallenge,
            codeChallengeMethod,
            expiresAt,
            createdAt: now
        }).run();
    });

    return { connectionId, code: rawCode };
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
