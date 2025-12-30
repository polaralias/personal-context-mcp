# Stage 1: Build
FROM node:18-alpine AS builder

WORKDIR /app

COPY package*.json ./
COPY prisma ./prisma/

RUN npm install

COPY . .

RUN npx prisma generate
RUN npm run build

# Stage 2: Runtime
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
COPY prisma ./prisma/

# Install only production dependencies
RUN npm install --production

# Copy built artifacts from builder
COPY --from=builder /app/dist ./dist
# Copy OpenAPI spec if needed at runtime
COPY openapi.yaml ./
COPY public ./public

# Generate Prisma Client for the production environment
RUN npx prisma generate

EXPOSE 3000

CMD ["node", "dist/index.js"]
