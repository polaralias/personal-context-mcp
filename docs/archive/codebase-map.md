# Codebase Map

> Historical evidence note:
> This document records investigation-era understanding and may describe pre-repair behavior.
> Prefer `README.md`, `GLOSSARY.md`, `docs/product-specs/resolver-spec.md`, `docs/tool-reference.md`, and the passing test suite for current repository truth.

## Purpose hypothesis

Reading rule:

- this is a repository archaeology and current-shape document
- for current domain language and desired repair contract, start with `GLOSSARY.md` and `docs/product-specs/resolver-spec.md`

This repository appears to be a standalone MCP server that exposes a "personal context" API to AI clients.

The likely end goal is:

- let an MCP client ask "what is James doing / where is he / is he working / what is planned"
- combine manual status updates, scheduled future context, live Home Assistant location, holiday data, and Google Maps enrichment
- return a compact answer that an agent can use for planning, messaging, or workflow decisions

Working backwards from the tool surface, the core product is not a UI. It is a machine-facing context service.

## Current shape

- Primary implementation: `server.py`
- Local runtime helper: `scripts/run_server.py`
- Deployment scaffolding: `Dockerfile`, `docker-compose.yml`, `fastmcp.json`
- Reference docs: `README.md`, `docs/configuration.md`, `docs/tool-reference.md`
- Persistence: current default runtime path resolves from `sqlite:///data/mcp.db`, while compose also mounts `./state/data` to `/app/data`; this contract is not yet aligned
- Test suite: none present

This is a small repository with a single dominant code surface, so the main risk is not sprawl. The main risk is hidden behavior and undocumented assumptions inside `server.py`.

## Verified architecture

### 1. Transport and auth

The service is created as a FastMCP server with HTTP transport by default and optional static bearer-token auth. The auth implementation is a simple token comparer, not a broader identity or permission system.

Relevant code:

- `server.py:224` `StaticApiKeyVerifier`
- `server.py:1143` `_load_api_keys`
- `server.py:1216` auth wiring
- `server.py:1227` FastMCP server creation
- `server.py:1231`-`1242` health routes

### 2. Storage model

The database layer is a single SQLite connection with four tables:

- `work_status_events`
- `location_events`
- `scheduled_status`
- `bank_holidays_cache`

Relevant code:

- `server.py:699` `PersonalContextStore`
- `server.py:711`-`742` schema creation

### 3. External integrations

There are two optional integrations:

- Google Maps APIs for reverse geocoding and nearby places
- Home Assistant for polling a tracked entity's coordinates

Relevant code:

- `server.py:245` `GoogleMapsService`
- `server.py:435` `HomeAssistantConnector`

### 4. Background jobs

The service starts background threads for:

- Home Assistant polling
- Google backfill of unnamed locations
- old-data cleanup

Relevant code:

- `server.py:542` `RuntimeSourceManager`
- `server.py:602`-`606` job startup
- `server.py:665`-`695` loop implementations
- `server.py:1219` lifecycle hook

### 5. Resolution engine

Reads do not directly return raw rows. They go through a resolver that derives an "effective" context from several sources.

Relevant code:

- `server.py:1078` `StatusResolver`

Resolver inputs:

- manual work status events
- weekend and bank-holiday rules
- per-date scheduled-context entries, implemented as stored JSON patches
- latest location event, subject to staleness and expiry

### 6. Public MCP surface

The service exposes 14 tools, matching the docs:

- status read/set tools
- location read/set/history tools
- Home Assistant sync
- Google enrichment
- nearby places
- schedule CRUD
- holiday listing

Relevant code:

- `server.py:1247`-`1438`

## Domain map

### Domain: work status

Primary records are inserted into `work_status_events`.

Observed semantics:

- work status defaults to `"off"` if no valid event exists
- weekends and bank holidays force `"off"` unless a scheduled-context entry overrides it
- manual writes can include TTLs

Core files:

- `server.py:745` `insert_work_status`
- `server.py:852` `latest_valid_work_event`
- `server.py:1083`-`1107` resolver logic

### Domain: location

Location can come from:

- manual writes via MCP
- Home Assistant polling
- Google reverse-geocode enrichment

Location is treated as valid only when:

- not expired
- not older than `LOCATION_STALE_HOURS`

Core files:

- `server.py:760` `insert_location`
- `server.py:818` `latest_location_without_name`
- `server.py:871` `latest_location_event`
- `server.py:1109`-`1125` resolver logic

### Domain: schedule

Schedule is stored per calendar date as a JSON patch, but the intended product concept is a scheduled-context entry that can carry planned work status and planned location together.

Core files:

- `server.py:900` `upsert_schedule`
- `server.py:946` `list_schedules`
- `server.py:1410`-`1433` schedule tools

### Domain: holidays

The service fetches GOV.UK bank holidays and caches them in SQLite.

Core files:

- `server.py:1037` `HolidayService`
- `server.py:1437` `holidays_list`

### Domain: operations/runtime

The repository includes enough to run locally or in Docker, but it is still a service package rather than a polished product.

Core files:

- `scripts/run_server.py`
- `Dockerfile`
- `docker-compose.yml`
- `fastmcp.json`

## Runtime flow

1. Process starts and resolves env/config.
2. SQLite store is opened and schema is created if missing.
3. FastMCP server is created.
4. Lifecycle startup launches background threads.
5. MCP clients call tools.
6. Write tools persist raw events or scheduled-context entries.
7. Read tools call `StatusResolver`, which computes the effective state.

## Verified mismatches and risk areas

These are the main places where the apparent product goal and the current implementation diverge.

### 1. Scheduled location is stored but not used during resolution

The schedule tool accepts a `location` field and persists it, but the resolver only applies `patch["workStatus"]`. It never applies `patch["location"]`.

Why it matters:

- schedule data suggests planned location-aware context
- actual effective context ignores scheduled location entirely
- clients may assume a feature exists because the API accepts the field

Relevant code:

- `server.py:1099`-`1102`
- `server.py:1411`-`1418`

### 2. Holiday lookup is keyed to the current year, not the target date's year

`HolidayService.fetch_holidays()` always uses `_now_utc().year`, and `is_bank_holiday(target)` calls it without passing a year.

Why it matters:

- `status_get(date=...)` for past or future years can produce wrong holiday answers
- this weakens confidence in date-based resolution generally

Relevant code:

- `server.py:1041`-`1043`
- `server.py:1068`-`1075`

### 3. "Override" and "set work" are effectively the same operation

`status_set_override()` and `status_set_work()` both insert into the same `work_status_events` table and resolve through the same logic.

Why it matters:

- tool naming implies two concepts
- implementation currently suggests one concept with two entry points
- docs may overstate the distinction

Relevant code:

- `server.py:1253`-`1275`

### 4. Work status history semantics are weak for non-current dates

The resolver calls `latest_valid_work_event(target)`, but that query only checks expiry and ordering. It does not constrain records to `created_at <= target`.

Why it matters:

- a later manual event can influence earlier or future date queries
- "resolve status for a supplied date" is only partly true
- this makes historical and future reads aspirational rather than trustworthy

Relevant code:

- `server.py:852`-`863`
- `server.py:1091`

### 5. Several documented runtime knobs appear to be informational only

Variables like `MASTER_KEY`, `CODE_TTL_SECONDS`, `TOKEN_TTL_SECONDS`, and rate-limit settings appear in docs, examples, and health payloads, but there is no corresponding enforcement or feature path in the implementation beyond echoing values in health output.

Why it matters:

- the public docs describe more operational sophistication than the code currently demonstrates
- for a public portfolio repo, this creates credibility risk

Relevant code:

- `server.py:1165`-`1200`
- `docs/configuration.md`
- `fastmcp.json`

## Initial state assessment

This repository is not chaos. It has a coherent product shape:

- one server
- one persistence layer
- one main resolver
- a narrow and understandable tool surface

But it is not yet first-class in the "publicly presentable" sense because the trust model is weak:

- docs are mostly derived from code, not validated against behavior
- there is no automated test suite
- some tool contracts are broader than the logic that actually resolves state
- some config/auth claims look like leftovers from an earlier architecture

## What appears to be the real product today

The real implemented product is narrower than the docs suggest:

- a personal status and location MCP service
- backed by SQLite
- able to accept manual updates
- able to poll Home Assistant for coordinates
- able to enrich coordinates with Google APIs
- able to expose nearby places
- able to maintain simple per-day scheduled context

That is a valid product. The gap is precision, verification, and contract clarity.

## Suggested follow-up investigation containers

If this repository is being hardened in stages, the next research passes should be:

1. Resolver correctness audit
   Focus on date semantics, precedence rules, TTL behavior, and whether scheduled location should affect effective context.

2. Tool contract audit
   Compare each MCP tool's documented promise against real behavior and produce a truth-table style compatibility matrix.

3. Runtime/auth audit
   Separate active security controls from legacy/documentary config residue.

4. Integration verification
   Exercise Home Assistant sync, Google reverse geocoding, nearby places, and holiday fetch with controlled fixtures.

5. Test strategy
   Define a minimal suite around resolver behavior first, because that is the product core.
