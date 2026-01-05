import { z } from 'zod';

export const personalContextConfigSchema = z.object({
    googleApiKey: z.string().optional().describe('Google Maps API Key for location services'),
    projectId: z.string().optional().describe('Project ID for identifying context'),
    homeLocation: z.object({
        lat: z.number().min(-90).max(90),
        lon: z.number().min(-180).max(180)
    }).optional().describe('Home location coordinates'),
});

export type PersonalContextConfig = z.infer<typeof personalContextConfigSchema>;

export const configFields = [
    {
        name: 'googleApiKey',
        type: 'password',
        required: false,
        label: 'Google Maps API Key',
        helpText: 'Required for accurate address lookup and location history features.'
    },
    {
        name: 'projectId',
        type: 'text',
        required: false,
        label: 'Project ID',
        helpText: 'Identifier for this specific context instance.'
    },
    {
        name: 'homeLocation',
        type: 'json',
        required: false,
        label: 'Home Location',
        helpText: 'JSON object with lat/lon, e.g., {"lat": 51.5, "lon": -0.1}'
    }
];

export const validateConfig = (config: unknown) => {
    return personalContextConfigSchema.safeParse(config);
};

// Optional: Implement verification logic (e.g., test Google API key)
export const verifyConfig = async (config: PersonalContextConfig): Promise<boolean> => {
    // Mock verification for now
    if (config.googleApiKey && config.googleApiKey.length < 5) {
        return false;
    }
    return true;
};
