import { z } from 'zod';

export type ConfigField = {
    name: string;
    type: 'text' | 'password' | 'textarea' | 'select' | 'checkbox';
    required: boolean;
    label: string;
    description?: string;
    placeholder?: string;
    format?: 'csv' | 'json';
    options?: Array<{ label: string; value: string }>;
};

const userBoundFields: ConfigField[] = [
    {
        name: 'apiKey',
        label: 'ClickUp API Key',
        type: 'password',
        required: true,
        placeholder: 'pk_...',
        description: 'Your personal API token from ClickUp settings'
    },
    {
        name: 'teamId',
        label: 'Team ID',
        type: 'text',
        required: false,
        description: 'Optional: ID of the workspace to use'
    }
];

const connectFields: ConfigField[] = [
    {
        name: 'apiKey',
        label: 'ClickUp API Key',
        type: 'password',
        required: true,
        placeholder: 'pk_...',
        description: 'Your personal API token from ClickUp settings'
    },
    {
        name: 'readOnly',
        label: 'Read Only',
        type: 'checkbox',
        description: 'If checked, the server will not modify any data'
    },
    {
        name: 'selectiveWrite',
        label: 'Selective Write',
        type: 'checkbox',
        description: 'Enable granular write permissions'
    },
    {
        name: 'writeSpaces',
        label: 'Write Spaces',
        type: 'text',
        format: 'csv',
        description: 'Comma-separated list of Space IDs allowed to write to'
    },
    {
        name: 'writeLists',
        label: 'Write Lists',
        type: 'text',
        format: 'csv',
        description: 'Comma-separated list of List IDs allowed to write to'
    }
];

const userBoundSchema = z
    .object({
        apiKey: z.string().min(1),
        teamId: z.string().optional()
    })
    .strict();

const connectSchema = z
    .object({
        apiKey: z.string().min(1),
        readOnly: z.boolean().optional(),
        selectiveWrite: z.boolean().optional(),
        writeSpaces: z.array(z.string()).optional(),
        writeLists: z.array(z.string()).optional()
    })
    .strict();

export const getUserBoundSchema = () => ({ fields: userBoundFields });

export const getConnectSchema = () => ({ fields: connectFields });

export const validateUserBoundConfig = (config: unknown) => userBoundSchema.safeParse(config);

export const validateConnectConfig = (config: unknown) => connectSchema.safeParse(config);
