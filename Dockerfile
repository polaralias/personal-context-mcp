# Stage 1: Build
FROM node:22-alpine AS builder

WORKDIR /app

# Copy package files first to leverage Docker layer caching
COPY package*.json ./
COPY prisma ./prisma/

# Install dependencies in the container
# We use 'npm install' as requested to ensure it runs during build
RUN npm install

# Install openssl for Prisma
RUN apk add --no-cache openssl

# Copy the rest of the application code
COPY . .

# Generate Prisma Client
RUN npx prisma generate

# Build the application
RUN npm run build

# Stage 2: Runtime
FROM node:22-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY prisma ./prisma/

# Install openssl for Prisma
RUN apk add --no-cache openssl

# Install only production dependencies
RUN npm install --omit=dev

# Copy built artifacts from builder
COPY --from=builder /app/dist ./dist

# Copy the generated Prisma Client artifacts
COPY --from=builder /app/node_modules/.prisma /app/node_modules/.prisma

# Copy OpenAPI spec if needed at runtime
COPY openapi.yaml ./

EXPOSE 3000

CMD ["node", "dist/index.js"]

