# Test Plan

## Purpose

This plan defines the minimum executable safety net required before broad repair and refactor work can proceed.

The goal is not maximal coverage. The goal is coverage over the repository’s real risk surface.

## Current execution status

Implemented and passing today:

- `59` total pytest cases
- a pytest harness with in-memory store fixtures
- resolver tests for temporal correctness, schedule precedence, scheduled location, location leakage prevention, TTL edge cases, scheduled-context validation, current-date live-location freshness boundaries, and scheduled-location normalisation
- tool contract tests for minimal effective-context shape, normalised live-location output shape, legacy-surface removal, and public provenance-boundary enforcement
- store tests for schema initialisation, schedule persistence, bounded history queries, and cleanup behaviour
- runtime tests for location-history limit validation, default database path resolution, and target-year holiday cache lookup
- HTTP tests for public health access, precise health auth posture, safe-by-default auth enforcement, auth disable mode, and API-key alias normalisation
- mocked integration tests for Google reverse geocoding success, failure, and malformed payload handling, Nearby Search success and error surfacing, Home Assistant success and safe failure including invalid coordinates, and holiday cache write and fallback behaviour

## Testing principles

### 1. Test the product contract first

The highest-value tests are the ones that prove:

- what effective context means
- which source wins
- when data is ignored

### 2. Prefer small deterministic tests

Most core tests should run:

- locally
- with in-memory SQLite
- without network access

### 3. Separate unit and contract tests

- unit tests prove local logic
- contract tests prove public tool behaviour

## Coverage map

### Track A. Resolver tests

Priority: `critical`

These are the highest-priority resolver tests.

#### A1. Baseline work-status tests

Prove:

- default status is `off`
- weekend baseline is `off`
- holiday baseline is `off`
- `weekend` and `bankHoliday` remain visible as factual booleans even when scheduled or event-driven work status wins
- non-current dates without scheduled context still resolve baseline work status rather than `unknown`

#### A2. Temporal correctness tests

Prove:

- an event created after a target date does not affect that target date
- an event created before a target date may affect it if still valid
- the latest applicable event wins

#### A3. TTL tests for work status

Prove:

- unexpired event applies
- expired event does not apply
- later expired event does not outrank an earlier still-valid event incorrectly

#### A4. Schedule precedence tests

Prove:

- scheduled `workStatus` overrides weekend baseline
- current-date valid work-status event outranks scheduled `workStatus`
- non-current date scheduled `workStatus` is authoritative when present
- date mismatches do not apply a patch

#### A5. Location freshness tests

Prove:

- latest non-expired location applies
- expired location is excluded
- stale location is excluded
- latest valid location wins

#### A6. Scheduled location tests

Prove:

- scheduled location affects effective context on the matching date
- scheduled location overrides incompatible current live location for future-date planning queries
- scheduled location and scheduled work status can coexist in one scheduled context entry
- non-current dates without scheduled context resolve `location` as `null`
- current-date live location outranks scheduled location
- current-date scheduled location applies only when no valid live location exists
- past dates without scheduled context resolve `location` as `null` even if raw location history exists

#### A7. Scheduled-context validation tests

Prove:

- scheduled context with only `reason` is rejected
- scheduled context with only `workStatus` is valid
- scheduled context with only `location` is valid
- scheduled context with both `workStatus` and `location` is valid
- invalid scheduled-context source values are rejected
- public scheduled-context writes reject non-manual provenance
- scheduled location with missing coordinates is rejected
- scheduled location with non-numeric coordinates is rejected
- scheduled location input is normalised to `locationName`

### Track B. Store tests

Priority: `high`

#### B1. Schema initialisation tests

Prove:

- all expected tables are created
- key indexes exist

#### B2. Query semantics tests

Prove:

- latest applicable work-event query behaves as intended
- location history filtering respects bounds
- cleanup removes only data older than retention cutoff

#### B3. Schedule persistence tests

Prove:

- upsert replaces existing patch for the same date
- list ordering is stable
- delete behaviour is correct

### Track C. Tool contract tests

Priority: `high`

These should call public tool functions against isolated in-memory state.

#### C1. Status tool tests

Prove:

- `status_get` returns expected shape
- `status_get` always returns a minimal structured answer rather than an empty payload
- `status_get_work` returns expected shape
- `status_set_work` appends and resolves as documented
- `reason` does not alter work-status resolution
- winning `reason` is surfaced in effective-context reads when present
- structured provenance for winning work-status and location sources is surfaced in effective-context reads
- provenance fields use the controlled vocabulary defined by the resolver specification
- the end-state work-status write contract remains intent-shaped rather than exposing raw event mechanics

#### C1a. Legacy-surface removal tests

Prove:

- end-state tool inventory does not expose `status_set_override`

#### C2. Location tool tests

Prove:

- `status_get_location` returns null when location is stale or expired
- `status_set_location` stores and returns expected output shape
- `status_get_location_history` validates or documents accepted range inputs
- invalid location source values are rejected according to the repaired contract
- public location writes reject non-manual provenance
- manual location writing remains part of the end-state tool surface

#### C3. Schedule tool tests

Prove:

- valid schedule writes succeed
- invalid date format fails
- empty patch behaviour matches the intended repaired contract
- `reason` may be returned or stored but does not affect scheduled-context precedence
- scheduled-context list and read surfaces remain valid first-class planning interfaces

#### C4. Holiday tool tests

Prove:

- valid region returns structured results
- invalid region behaviour is clear and stable

### Track D. Auth and HTTP tests

Priority: `high`

#### D1. Health route tests

Prove:

- `/health` returns `200`
- health payload contains the expected top-level fields

#### D2. MCP auth tests

Prove:

- unauthenticated `/mcp` requests fail when auth is enabled
- authenticated `/mcp` requests pass auth
- auth disable mode removes the auth gate

#### D3. Auth configuration tests

Prove:

- `PERSONAL_CONTEXT_MCP_API_KEY` works
- `MCP_API_KEY` works
- `MCP_API_KEYS` works
- duplicate keys are normalised safely

### Track E. Integration tests with mocks

Priority: `medium`

#### E1. Google reverse geocode mock tests

Prove:

- success path stores a name
- API failure leaves location write intact
- malformed payload degrades safely

#### E2. Google Nearby Search mock tests

Prove:

- request validation works
- HTTP errors surface clearly
- result normalisation returns the expected fields

#### E3. Home Assistant mock tests

Prove:

- successful poll stores coordinates
- missing attributes fail safely
- invalid coordinates fail safely

#### E4. Holiday fetch mock tests

Prove:

- cache write happens on success
- cached data is used on fetch failure when available

## Suggested implementation order

### Phase 1

- Track A
- Track C for status and schedule

### Phase 2

- Track B
- Track D

### Phase 3

- Track E
- Track C remainder

## Required harness features

Current harness features:

- formal pytest runner
- in-memory store fixtures
- isolated module-state fixtures for tool tests
- HTTP test client support for route and auth tests

Still desirable:

- None currently required beyond the existing mocked integration helpers

## Definition of sufficient safety

The repository is safe enough for broader repair and refactor work when:

- Track A is complete
- the highest-risk resolver bugs are covered by failing-then-passing tests
- Track D confirms the HTTP and auth contract
- key public tools have contract tests

Current status:

- this threshold has been met for the core resolver, tool, runtime, and auth contract surfaces
- no remaining tracked coverage work blocks safe targeted refactor work
