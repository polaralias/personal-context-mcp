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
        name: 'googleMapsApiKey',
        label: 'Google Maps API Key',
        type: 'password',
        required: true,
        placeholder: 'AIza...',
        description: 'Your Google Maps API Key for location lookups'
    },
    {
        name: 'homeLocation',
        label: 'Home Location',
        type: 'text',
        required: true,
        placeholder: 'e.g. London, UK',
        description: 'Your primary home location'
    },
    {
        name: 'haUrl',
        label: 'Home Assistant URL',
        type: 'text',
        required: false,
        placeholder: 'https://...',
        description: 'Optional: Your Home Assistant instance URL'
    },
    {
        name: 'haToken',
        label: 'Home Assistant Token',
        type: 'password',
        required: false,
        description: 'Optional: Long-lived access token for Home Assistant'
    },
    {
        name: 'haEntityId',
        label: 'Home Assistant Entity ID',
        type: 'text',
        required: false,
        placeholder: 'device_tracker.my_phone',
        description: 'Optional: Entity ID to poll for location'
    }
];

const connectFields: ConfigField[] = [
    {
        name: 'googleMapsApiKey',
        label: 'Google Maps API Key',
        type: 'password',
        required: true,
        placeholder: 'AIza...',
        description: 'Your Google Maps API Key for location lookups'
    },
    {
        name: 'homeLocation',
        label: 'Home Location',
        type: 'text',
        required: true,
        placeholder: 'e.g. London, UK',
        description: 'Your primary home location'
    },
    {
        name: 'haUrl',
        label: 'Home Assistant URL',
        type: 'text',
        required: false,
        placeholder: 'https://...',
        description: 'Optional: Your Home Assistant instance URL'
    },
    {
        name: 'haToken',
        label: 'Home Assistant Token',
        type: 'password',
        required: false,
        description: 'Optional: Long-lived access token for Home Assistant'
    },
    {
        name: 'haEntityId',
        label: 'Home Assistant Entity ID',
        type: 'text',
        required: false,
        placeholder: 'device_tracker.my_phone',
        description: 'Optional: Entity ID to poll for location'
    }
];

const userBoundSchema = z
    .object({
        googleMapsApiKey: z.string().min(1),
        homeLocation: z.string().min(1),
        haUrl: z.string().optional(),
        haToken: z.string().optional(),
        haEntityId: z.string().optional()
    })
    .strict();

const connectSchema = z
    .object({
        googleMapsApiKey: z.string().min(1),
        homeLocation: z.string().min(1),
        haUrl: z.string().optional(),
        haToken: z.string().optional(),
        haEntityId: z.string().optional()
    })
    .strict();

export const getUserBoundSchema = () => ({ fields: userBoundFields });

export const getConnectSchema = () => ({ fields: connectFields });

export const validateUserBoundConfig = (config: unknown) => userBoundSchema.safeParse(config);

export const validateConnectConfig = (config: unknown) => connectSchema.safeParse(config);
