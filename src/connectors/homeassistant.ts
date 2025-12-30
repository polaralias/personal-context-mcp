import prisma from '../db';

interface HAConfig {
  baseUrl: string;
  token: string;
  entityId: string;
}

export class HomeAssistantConnector {
  private config: HAConfig;

  constructor(config: HAConfig) {
    this.config = config;
  }

  async pollLocation() {
    try {
      const response = await fetch(`${this.config.baseUrl}/api/states/${this.config.entityId}`, {
        headers: {
          Authorization: `Bearer ${this.config.token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`HA poll failed: ${response.statusText}`);
      }

      const data = await response.json();
      const attributes = data.attributes;

      if (attributes.latitude && attributes.longitude) {
        await prisma.locationEvent.create({
            data: {
                source: 'homeassistant',
                latitude: attributes.latitude,
                longitude: attributes.longitude,
                name: data.state !== 'not_home' ? data.state : undefined,
                expiresAt: new Date(Date.now() + 60 * 60 * 1000)
            }
        });
      }

    } catch (error) {
      console.error('Error polling Home Assistant:', error);
    }
  }
}
