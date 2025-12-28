
Status MCP Implementation Document

1. Overview

A container-based microservice that stores and serves canonical “user status” context for downstream automations and agents. It aggregates multiple signals (location, calendar/task-derived work intent, time and UK bank holiday awareness, and explicit overrides) and returns a resolved status snapshot for “now” and for arbitrary dates.

Primary goal: provide a single source of truth so automations can make consistent decisions.

1.1 Goals

Deterministic resolution of status for:

“now” (current snapshot)

a specific date (future or past)


Multiple sources with precedence and traceability.

Manual overrides with expiry/TTL.

Minimal, reliable deployment: Docker image + Compose + optional Smithery deployment.

Clear contract: OpenAPI and stable schemas.


1.2 Non-goals

Full calendar/task system replication.

High-frequency real-time location tracking.

Storing raw sensitive data longer than needed.



---

2. Core Components

2.1 Location Tracking

Sources

Primary: Home Assistant (when available)

Secondary: Google Location (fallback)

Manual override via API


Data stored

Latitude/longitude

Optional locationName (user-defined label like home, office)

Source, timestamp, and confidence (optional but useful)


Update behaviour

Polling schedule (configurable): default 4–8 times/day for HA, 2–4 times/day for Google.

If HA is healthy and recent, it wins over Google.

Manual override can optionally set a TTL (recommended) to avoid sticking forever.


Privacy

Default to storing coordinates only.

Optional coarse mode: store only locationName if you want to avoid raw lat/long for some consumers.


2.2 Temporal Awareness

Day of week

Derived at request-time from the requested date, not stored as authoritative.

TypeScript enum can be used for display, but canonical representation should be standard (0–6 or ISO weekday 1–7) to avoid locale quirks.


UK Bank holidays

Source: GOV.UK bank holidays JSON

Cache results in DB (or file cache) with refresh policy (default once daily).

Resolve bankHoliday=true if requested date is in the England and Wales list (or configurable region).


Default rules

Weekends ⇒ workStatus="off" (unless overridden)

Bank holidays ⇒ workStatus="off" (unless overridden)


2.3 Work Status

Sources

ClickUp scanning via your “Poke” automation (external to this service)

Manual override via API


States

working | off | travel | custom-string

Recommend also supporting a separate mode or tags array later, but keep v1 simple.


Update behaviour

Poke pushes current work status daily at 05:00 (configurable).

Manual overrides take precedence and can optionally include a TTL and a reason.


2.4 Future Scheduling

Concept

Date-indexed overrides for future status, resolved alongside defaults and current snapshot.


Precedence (date resolution) For a given date D:

1. Exact-date manual scheduled override (for D)


2. Derived temporal defaults for D (bank holiday/weekend rules)


3. Current status fallback (for fields not specified by 1 or 2)



For “now” resolution, also apply “active” TTL-based overrides (for example manual work status override valid until time T).


---

3. Technical Implementation

3.1 Architecture

Runtime

Node.js + TypeScript service (Express or Fastify)

Runs as a single container


Storage

Recommended: PostgreSQL (simple relational model, indexing by date, good for audit/history)

Alternative: MongoDB (works, but date-indexed overrides and querying are often simpler in Postgres)


Auth

If only used within your private network: API key header (simplest and robust)

If you genuinely need “session-based”: add later with cookies + CSRF, but it is usually unnecessary for service-to-service.

Default recommendation for v1:

Authorization: Bearer <STATUS_MCP_TOKEN>

Optional per-client tokens with scopes later.



Smithery deployment

Provide:

Container image

MCP manifest/config (tools/resources)

Environment variables documented

Health endpoints for orchestrators



Operational concerns

Health checks: /healthz, /readyz

Structured logging (JSON)

Rate limiting optional (or rely on reverse proxy)



---

4. API Design

4.1 REST Endpoints (HTTP)

Core Status

GET /status

Returns resolved status for “now”


PUT /status

Updates multiple fields at once (manual override). Should support ttlSeconds and reason.


GET /status/date/:date

Returns resolved status for the given date (YYYY-MM-DD), applying precedence rules.



Work Status

GET /status/work

PUT /status/work

GET /status/work/date/:date


Location

GET /status/location

PUT /status/location

GET /status/location/history?from=...&to=...&limit=...


Temporal

GET /holidays

Upcoming holidays, cached


GET /holidays/:year

Holidays for specific year, cached



Future Status Scheduling

PUT /status/schedule

Upsert scheduled override for a date


GET /status/schedule?from=...&to=...

View scheduled changes


DELETE /status/schedule/:date

Remove scheduled override



4.2 Response semantics

All timestamps ISO 8601 (YYYY-MM-DDTHH:mm:ss.sssZ)

Dates in routes are YYYY-MM-DD

Always include resolvedAt and (optionally) provenance for debug builds.


4.3 Errors

Use consistent JSON:

{
  "error": {
    "code": "INVALID_DATE",
    "message": "Date must be YYYY-MM-DD",
    "details": {}
  }
}

Common codes:

UNAUTHORISED

FORBIDDEN

INVALID_PAYLOAD

INVALID_DATE

NOT_FOUND

RATE_LIMITED

INTERNAL_ERROR



---

5. MCP Interface (Smithery-friendly)

Expose MCP “tools” mirroring your HTTP API (thin wrapper).

5.1 Tools

status_get_now → GET /status

status_get_date (date) → GET /status/date/:date

status_set_override (partial status + ttl + reason) → PUT /status

status_set_work (workStatus + ttl + reason) → PUT /status/work

status_set_location (lat/lon + name + ttl + reason) → PUT /status/location

status_schedule_set (date + partial) → PUT /status/schedule

status_schedule_list (from/to) → GET /status/schedule

status_schedule_delete (date) → DELETE /status/schedule/:date

holidays_list / holidays_year


5.2 Resources (optional)

status://current

status://date/YYYY-MM-DD

status://schedule


If you keep only tools for v1, that’s fine.


---

6. Data Models

6.1 Enums and types

Recommendation: store weekday as numeric/ISO, and optionally also return display name.

export type WorkStatus = 'working' | 'off' | 'travel' | (string & {});

export type LocationSource = 'homeassistant' | 'google' | 'manual';

export interface Location {
  latitude: number;
  longitude: number;
  locationName?: string;
  source: LocationSource;
  timestamp: string;
}

6.2 Canonical resolved status

Add effectiveDate and resolvedAt so consumers can reason about it:

export interface Status {
  effectiveDate: string;   // YYYY-MM-DD for which this status is resolved
  resolvedAt: string;      // ISO timestamp when resolution occurred

  bankHoliday: boolean;
  weekend: boolean;

  workStatus: WorkStatus;
  location: Location | null;

  lastUpdated: string;     // last time any contributing signal changed
}

6.3 Manual overrides (time-bounded)

export interface Override<T> {
  value: T;
  reason?: string;
  createdAt: string;
  expiresAt?: string;
  source: 'manual' | 'poke' | 'system';
}

6.4 Scheduling

Your current FutureStatus definition is missing the generic parameter. Use:

export type ScheduledStatusPatch = Partial<Pick<Status, 'workStatus' | 'location'>> & {
  reason?: string;
};

export type FutureStatus = Record<string, ScheduledStatusPatch>; // key is YYYY-MM-DD

Or better, normalise into rows in the DB rather than a single JSON blob.

6.5 Provenance (optional but valuable)

export interface Provenance {
  workStatus?: { source: string; updatedAt: string };
  location?: { source: string; updatedAt: string };
  bankHoliday?: { source: string; updatedAt: string };
}


---

7. Resolution Logic

7.1 Resolve status for date D

Inputs:

Scheduled overrides for D

Temporal evaluation for D (weekend/bank holiday)

Current “base” values (latest known workStatus/location)

Active TTL overrides that apply at the time-of-day if resolving “now”


Algorithm outline:

1. Compute weekend and bankHoliday for D.


2. Start with base status:

base workStatus = latest known (from Poke/manual)

base location = latest known (from HA/Google/manual)



3. Apply temporal default:

if weekend || bankHoliday, set workStatus to off unless an override will supersede it.



4. Apply scheduled override for D (highest precedence for that date).


5. If resolving “now”, apply any active TTL overrides for fields (manual overrides with not-yet-expired expiresAt).


6. Return resolved status + timestamps + optional provenance.



7.2 Location precedence

For location “now”:

1. Active manual override (not expired)


2. Home Assistant reading if fresh (freshness threshold, eg 12h)


3. Google reading if fresh (threshold, eg 24h)


4. null/unknown




---

8. Integrations

8.1 Home Assistant connector

Poll HA REST endpoint(s) or use a long-lived token.

Store last successful fetch time.

Config:

base URL

token

entity IDs (device tracker/person entity)

polling cadence



8.2 Google location connector

Poll cadence lower than HA.

Store just enough fields for your status use.

Ensure secrets handled via env vars and not logged.


8.3 Poke → Status MCP (ClickUp scan)

Poke calls PUT /status/work daily (or as-needed) with:

workStatus

optional reason (eg “has ClickUp meetings”)

source='poke'




---

9. Persistence Model (Postgres recommended)

Tables (suggested minimal set):

work_status_events

id, created_at, source, status, reason, expires_at nullable


location_events

id, created_at, source, lat, lon, name nullable, expires_at nullable


scheduled_status

date (PK, YYYY-MM-DD)

patch (JSONB)

created_at, updated_at


bank_holidays_cache

region, year, payload (JSONB), fetched_at



Indexes:

latest queries by created_at DESC

scheduled status by date


Retention:

location/work events keep (eg) 90 days, configurable.



---

10. OpenAPI/Swagger

Ship openapi.yaml in the repo.

Serve Swagger UI at /docs in non-production or behind auth.


Minimum documented schemas:

Status

Location

ScheduledStatusPatch

Error schema



---

11. Docker and Docker Compose

11.1 Container

Multi-stage Dockerfile:

build TS → dist/

runtime node image


Environment variables:

PORT

DATABASE_URL

AUTH_TOKEN (or multiple tokens)

HA_URL, HA_TOKEN, HA_POLL_CRON

GOOGLE_*, GOOGLE_POLL_CRON

HOLIDAYS_REGION, HOLIDAYS_REFRESH_CRON



11.2 Compose

Services:

status-mcp

postgres

optional adminer/pgadmin


Healthchecks:

Postgres: pg_isready

Service: GET /healthz



---

12. Observability

Logs: JSON, include request id and user id (if you support multi-user later)

Metrics (optional v1):

last poll success timestamp per connector

resolver hit counts


Debug endpoint (auth-gated):

GET /status/explain returning provenance and applied rules




---

13. Testing

Unit tests:

resolution logic for precedence and edge cases

holiday matching


Integration tests:

DB persistence

endpoints and auth


Contract tests:

OpenAPI schema validation


Determinism tests:

fixed inputs must yield identical resolved outputs



Edge cases to include:

Manual override expires mid-day

Scheduled override on bank holiday should supersede default “off”

HA stale, Google fresh

Neither location source available



---

14. Implementation Plan (Codex-ready breakdown)

1. Repo scaffolding

TS service framework, linting, test runner



2. Core data model + DB migrations


3. Holiday cache fetcher + resolver


4. Status resolver engine (pure function, heavily tested)


5. REST API endpoints + OpenAPI


6. Auth middleware


7. HA connector + Google connector (pollers)


8. Scheduling endpoints


9. Dockerfile + Compose


10. Smithery MCP wrapper layer (tools/resources)


11. Observability and health checks



Acceptance criteria for v1:

GET /status returns correct work status for weekends and bank holidays.

Manual PUT /status/work overrides defaults and can expire.

PUT /status/schedule sets an exact-date override that resolves correctly via GET /status/date/:date.

Location resolves with precedence and freshness thresholds.

Runs via docker compose up with persistent DB.
