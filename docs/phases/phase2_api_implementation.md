# Phase 2: API and Core Features

This phase exposes the logic from Phase 1 via a REST API and implements the persistence layers for user interactions.

## Steps

### 2.1 API Server Setup
**Objective**: Set up the HTTP server framework.
**Actions**:
1.  Install Express (or Fastify): `npm install express cors helmet morgan @types/express @types/cors @types/morgan`.
2.  Set up `src/app.ts` and `src/server.ts`.
3.  Configure middleware: JSON body parser, CORS, Helmet (security headers), Morgan (logging).
4.  Implement a Global Error Handler.

**Verification**:
*   `GET /healthz` returns 200 OK.

### 2.2 Authentication Middleware
**Objective**: Secure the API.
**Actions**:
1.  Implement `src/middleware/auth.ts`.
2.  Check for `Authorization: Bearer <TOKEN>` header.
3.  Compare against `STATUS_MCP_TOKEN` environment variable.
4.  Return 401 Unauthorized if invalid.

**Verification**:
*   Requests without token fail.
*   Requests with correct token pass.

### 2.3 Status Endpoints
**Objective**: Implement endpoints to read and write status.
**Actions**:
1.  **GET /status**:
    *   Fetch latest data from DB.
    *   Call `resolveStatus` (from Phase 1) for "now".
    *   Return result.
2.  **GET /status/date/:date**:
    *   Fetch scheduled overrides for date.
    *   Call `resolveStatus` for that date.
3.  **PUT /status**:
    *   Accepts partial status (workStatus, location), `ttlSeconds`, `reason`.
    *   Writes to `WorkStatusEvent` or `LocationEvent` tables.
4.  **PUT /status/work**: Specific endpoint for work status.

**Verification**:
*   Integration tests: `PUT` data, then `GET` to verify it's reflected.
*   Verify `ttlSeconds` effectively expires the override (logic verification, actual expiry handling might need Phase 3 refinement).

### 2.4 Location Endpoints
**Objective**: Manage location data.
**Actions**:
1.  **PUT /status/location**:
    *   Accepts lat, lon, name, source.
    *   Writes to `LocationEvent` table.
2.  **GET /status/location**:
    *   Returns resolved location.
3.  **GET /status/location/history**:
    *   Returns list of recent location events (useful for debugging/visualisation).

**Verification**:
*   Verify data persistence and retrieval.

### 2.5 Scheduling Endpoints
**Objective**: Manage future overrides.
**Actions**:
1.  **PUT /status/schedule**:
    *   Accepts `date`, `patch` (JSON), `reason`.
    *   Upsert into `ScheduledStatus` table.
2.  **GET /status/schedule**: List upcoming schedules.
3.  **DELETE /status/schedule/:date**: Remove an override.

**Verification**:
*   Create a schedule for next Monday.
*   `GET /status/date/<next_monday>` should reflect the schedule.
*   `GET /status/date/<today>` should remain unchanged.

### 2.6 Validation
**Objective**: Ensure input integrity.
**Actions**:
1.  Install Zod: `npm install zod`.
2.  Define schemas for API requests.
3.  Add validation middleware to endpoints.

**Verification**:
*   Send invalid payloads (e.g., bad date format, missing fields) and verify 400 Bad Request responses.
