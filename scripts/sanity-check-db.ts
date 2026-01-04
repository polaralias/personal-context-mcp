import { PrismaClient } from '@prisma/client';

async function main() {
    const prisma = new PrismaClient();
    try {
        console.log('Testing Prisma connection...');
        await prisma.$connect();
        console.log('Connected successfully.');
        const result = await prisma.$queryRaw`SELECT 1 as result`;
        console.log('Query result:', result);
    } catch (e) {
        console.error('Prisma connection failed:', e);
        process.exit(1);
    } finally {
        await prisma.$disconnect();
    }
}

main();
