# Stage 1: Build
FROM node:22-alpine AS builder

WORKDIR /app

COPY package*.json ./
COPY prisma ./prisma/

# Install all dependencies (including devDependencies like prisma CLI)
RUN npm ci

# Install openssl for Prisma
RUN apk add --no-cache openssl

COPY . .

# Generate Prisma Client (artifacts go to node_modules/.prisma)
RUN npx prisma generate
# Build the application
RUN npm run build

# Stage 2: Runtime
FROM node:22-alpine

WORKDIR /app

COPY package*.json ./
COPY prisma ./prisma/

# Install openssl for Prisma
RUN apk add --no-cache openssl

# Install only production dependencies
RUN npm ci --omit=dev

# Copy built artifacts from builder
COPY --from=builder /app/dist ./dist

# Copy the generated Prisma Client artifacts
COPY --from=builder /app/node_modules/.prisma /app/node_modules/.prisma

# Copy OpenAPI spec if needed at runtime
COPY openapi.yaml ./
COPY src/public ./dist/public

EXPOSE 3000

CMD ["node", "dist/index.js"]
