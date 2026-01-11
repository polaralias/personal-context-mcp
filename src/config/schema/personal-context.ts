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
    secret?: boolean;
};

export const personalContextConfigSchema = z
    .object({
        googleApiKey: z.string().optional().describe('Google Maps API Key for location services'),
        projectId: z.string().optional().describe('Project ID for identifying context'),
        homeLocation: z
            .object({
                lat: z.number().min(-90).max(90),
                lon: z.number().min(-180).max(180)
            })
            .optional()
            .describe('Home location coordinates')
    })
    .strict();

export type PersonalContextConfig = z.infer<typeof personalContextConfigSchema>;

export const configFields: ConfigField[] = [
    {
        name: 'googleApiKey',
        type: 'password',
        required: false,
        label: 'Google Maps API Key',
        description: 'Required for accurate address lookup and location history features.',
        secret: true
    },
    {
        name: 'projectId',
        type: 'text',
        required: false,
        label: 'Project ID',
        description: 'Identifier for this specific context instance.'
    },
    {
        name: 'homeLocation',
        type: 'textarea',
        required: false,
        label: 'Home Location',
        description: 'JSON object with lat/lon, e.g., {"lat": 51.5, "lon": -0.1}',
        format: 'json'
    }
];

export const getConfigSchema = () => ({
    fields: configFields
});

export const normalizeConfigInput = (input: Record<string, unknown>) => {
    const normalized: Record<string, unknown> = {};
    const errors: string[] = [];

    for (const field of configFields) {
        if (!(field.name in input)) {
            continue;
        }

        let value = input[field.name];

        if (field.format === 'json' && typeof value === 'string') {
            const raw = value.trim();
            if (raw.length === 0) {
                value = undefined;
            } else {
                try {
                    value = JSON.parse(raw);
                } catch (error) {
                    errors.push(`${field.name} must be valid JSON`);
                }
            }
        }

        if (field.format === 'csv' && typeof value === 'string') {
            value = value
                .split(',')
                .map((entry) => entry.trim())
                .filter(Boolean);
        }

        if (value !== undefined) {
            normalized[field.name] = value;
        }
    }

    return { normalized, errors };
};

export const splitConfigBySecret = (config: Record<string, unknown>) => {
    const publicConfig: Record<string, unknown> = {};
    const secretConfig: Record<string, unknown> = {};

    for (const field of configFields) {
        if (!(field.name in config)) {
            continue;
        }

        if (field.secret) {
            secretConfig[field.name] = config[field.name];
        } else {
            publicConfig[field.name] = config[field.name];
        }
    }

    return { publicConfig, secretConfig };
};

export const validateConfig = (config: unknown) => {
    return personalContextConfigSchema.safeParse(config);
};

export const verifyConfig = async (config: PersonalContextConfig): Promise<boolean> => {
    if (config.googleApiKey && config.googleApiKey.length < 5) {
        return false;
    }
    return true;
};
