import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export class GoogleConnector {
  async pollLocation() {
    console.log('Google Location Poller: Not implemented yet');
  }
}
