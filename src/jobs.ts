import cron from 'node-cron';
import { HomeAssistantConnector } from './connectors/homeassistant';
import { GoogleConnector } from './connectors/google';
import { HolidayService } from './services/holiday';
import { ApiKeyService } from './services/apiKeyService';
import prisma from './db';
import { createLogger } from './logger';

const logger = createLogger('jobs');

const haConnector = new HomeAssistantConnector({
    baseUrl: process.env.HA_URL || '',
    token: process.env.HA_TOKEN || '',
    entityId: process.env.HA_ENTITY_ID || ''
});

const googleConnector = new GoogleConnector({
    apiKey: process.env.GOOGLE_API_KEY,
    pollCron: process.env.GOOGLE_POLL_CRON
});

const holidayService = HolidayService.getInstance();

export function startJobs() {
    // Poll Home Assistant every 15 minutes
    cron.schedule('*/15 * * * *', () => {
        if (process.env.HA_URL) {
            logger.info('polling Home Assistant');
            haConnector.pollLocation();
        }
    });

    // Poll Google Location
    // Default to every hour if not specified, but usually controlled by the connector logic or cron here.
    // The connector accepts pollCron in config but doesn't self-schedule. We schedule it here.
    const googleCron = process.env.GOOGLE_POLL_CRON || '0 * * * *';
    cron.schedule(googleCron, () => {
        // Google Connector has its own check for apiKey presence
        logger.info('polling Google Location');
        googleConnector.pollLocation();
    });

    // Refresh Holidays daily at 2am
    cron.schedule('0 2 * * *', () => {
        logger.info('refreshing holidays');
        holidayService.fetchHolidays();
    });

    // Revoke inactive API keys daily at 1am
    cron.schedule('0 1 * * *', () => {
        ApiKeyService.getInstance().revokeInactiveKeys();
    });

    // Data Cleanup Job: Runs daily at 3am
    cron.schedule('0 3 * * *', async () => {
        logger.info('running data cleanup');
        try {
            const daysToKeep = 90;
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

            const deletedWork = await prisma.workStatusEvent.deleteMany({
                where: {
                    createdAt: {
                        lt: cutoffDate
                    }
                }
            });

            const deletedLocation = await prisma.locationEvent.deleteMany({
                where: {
                    createdAt: {
                        lt: cutoffDate
                    }
                }
            });

            logger.info({
                deletedWork: deletedWork.count,
                deletedLocation: deletedLocation.count,
                daysToKeep
            }, 'data cleanup complete');
        } catch (error) {
            logger.error({ err: error }, 'error during data cleanup');
        }
    });

    logger.info('background jobs started');
}
