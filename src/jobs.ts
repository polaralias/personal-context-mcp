import cron from 'node-cron';
import { HomeAssistantConnector } from './connectors/homeassistant';
import { HolidayService } from './services/holiday';

const haConnector = new HomeAssistantConnector({
    baseUrl: process.env.HA_URL || '',
    token: process.env.HA_TOKEN || '',
    entityId: process.env.HA_ENTITY_ID || ''
});

const holidayService = HolidayService.getInstance();

export function startJobs() {
    // Poll Home Assistant every 15 minutes
    cron.schedule('*/15 * * * *', () => {
        if (process.env.HA_URL) {
            console.log('Polling Home Assistant...');
            haConnector.pollLocation();
        }
    });

    // Refresh Holidays daily at 2am
    cron.schedule('0 2 * * *', () => {
        console.log('Refreshing holidays...');
        holidayService.fetchHolidays();
    });

    console.log('Background jobs started');
}
