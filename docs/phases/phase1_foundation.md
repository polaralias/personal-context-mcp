# Phase 1: Foundation and Core Logic

This phase focuses on setting up the project structure, database, and the core, pure-logic components of the system.

## Steps

### 1.1 Project Scaffolding
**Objective**: Initialize the repository with TypeScript, linting, and testing tools.
**Actions**:
1.  Initialize a new Node.js project: `npm init -y`.
2.  Install TypeScript and development tools: `npm install -D typescript ts-node nodemon @types/node eslint prettier jest ts-jest @types/jest`.
3.  Configure `tsconfig.json` (strict mode, ES2020+ target).
4.  Configure ESLint and Prettier.
5.  Configure Jest for TypeScript testing.
6.  Create a basic folder structure: `src/`, `tests/`, `dist/`.

**Verification**:
*   Run `npm run build` (should succeed with empty/basic files).
*   Run `npm test` (should pass a sample test).

### 1.2 Database Setup
**Objective**: Set up PostgreSQL and the ORM (Prisma).
**Actions**:
1.  Install Prisma: `npm install prisma @prisma/client`.
2.  Initialize Prisma: `npx prisma init`.
3.  Define the schema in `prisma/schema.prisma` based on the data models (Section 6 & 9 of Implementation Plan).
    *   `WorkStatusEvent` (id, createdAt, source, status, reason, expiresAt)
    *   `LocationEvent` (id, createdAt, source, lat, lon, name, expiresAt)
    *   `ScheduledStatus` (date, patch, createdAt, updatedAt)
    *   `BankHolidayCache` (region, year, data, fetchedAt)
4.  Set up a local PostgreSQL instance (or use Docker).
5.  Run migrations: `npx prisma migrate dev --name init`.

**Verification**:
*   Database tables are created successfully.
*   Prisma client can connect and perform basic CRUD operations.

### 1.3 Bank Holiday Service
**Objective**: Implement fetching and caching of UK bank holidays.
**Actions**:
1.  Create `src/services/bankHoliday.ts`.
2.  Implement `fetchBankHolidays(region)`:
    *   Check DB cache first.
    *   If missing/stale, fetch from `https://www.gov.uk/bank-holidays.json`.
    *   Store in DB cache.
3.  Implement `isBankHoliday(date)`: Returns boolean if the date is a holiday.

**Verification**:
*   Unit tests mocking the HTTP request to GOV.UK.
*   Verify caching behavior (subsequent calls shouldn't hit the external API).

### 1.4 Status Resolution Engine
**Objective**: Implement the pure function logic for determining status.
**Actions**:
1.  Create `src/core/resolution.ts`.
2.  Implement `resolveStatus(date, context)`:
    *   **Context** includes: `scheduledOverrides`, `temporalRules` (weekend/holiday), `latestWorkStatus`, `latestLocation`, `activeTTLOverrides`.
    *   **Logic**:
        1.  Determine temporal defaults (weekend/holiday).
        2.  Apply "base" status (latest known).
        3.  Apply temporal rules (set to "off" if weekend/holiday, unless overridden).
        4.  Apply scheduled overrides for the specific date.
        5.  (If "now") Apply active TTL overrides.
3.  Return the canonical `Status` object.

**Verification**:
*   Extensive unit tests covering all precedence rules (e.g., Scheduled override > Bank Holiday > Default Weekend).
*   Edge cases: Expiry times, missing data.
