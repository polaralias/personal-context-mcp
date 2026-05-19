# Resolver Specification

## Purpose

The resolver is the core product surface of `personal-context-mcp`.

Its job is to answer:

- the effective work status for a target date
- the effective location for a target date and current moment
- supporting metadata about why that answer was chosen

This document defines the active resolver contract for the repaired repository state.

## Scope

This spec covers:

- work-status resolution
- location resolution
- schedule application
- holiday and weekend influence
- expiry and staleness behavior

This spec does not define:

- storage schema details
- HTTP transport details
- authentication behavior

## Inputs

The resolver operates over:

- a target date or datetime
- persisted work-status events
- persisted location events
- persisted scheduled-context entries
- holiday data
- runtime staleness configuration

Explanatory annotations such as `reason` may be returned alongside relevant records, but they are not resolver inputs for precedence decisions.

## Output contract

The resolver should return a single effective context object with:

- `effectiveDate`
- `resolvedAt`
- `bankHoliday`
- `weekend`
- `workStatus`
- `location`
- `reason`
- `lastUpdated`
- `workStatusProvenance`
- `locationProvenance`

These field names are part of the current tested public contract.

Optional explanatory fields may be included in read responses for model visibility, provided they do not alter effective-resolution semantics.

Location shape rule:

- `location` is either `null` or an object with `latitude`, `longitude`, and `locationName`
- when a live location event wins, the returned location also includes `source` and `timestamp`
- when scheduled location wins, the resolver normalizes the payload to the same `locationName` key and does not surface nested live-event provenance fields

Calendar-fact rule:

- `bankHoliday` and `weekend` remain factual fields about the target date
- they stay visible even when work status is determined by a higher-precedence source

Total-function rule:

- effective-context reads always return a minimal structured answer
- absence of planned or live data does not produce an empty or missing effective-context payload

Desired read rule:

- when a winning work-status or scheduled-context source has a `reason`, that `reason` may be returned with effective-context reads
- returned `reason` is explanatory only and must not be treated as a precedence input
- effective-context reads should also include structured provenance such as winning work-status source and winning location source

Initial controlled provenance vocabulary:

For work status:

- `baseline`
- `work-status-event`
- `scheduled-context`

For location:

- `location-event`
- `scheduled-context`
- `none`

Granularity rule:

- `baseline` remains a coarse provenance value
- factual detail about weekend and bank holiday remains in the separate `weekend` and `bankHoliday` fields

## Resolver principles

### 1. Temporal correctness

Resolution for a target date must only consider inputs that are valid for that target date.

Implication:

- a work-status event created after the target date must not affect that target date

### 2. Explicit precedence

If multiple inputs can determine the same answer, the precedence order must be defined and stable.

### 3. Explainable degradation

When an input is missing, stale, expired, or unavailable, the resolver should degrade in a documented way rather than mixing partial assumptions silently.

## Work-status resolution

### Desired sources

The effective work status may be influenced by:

- manual work-status events
- scheduled context
- weekend logic
- bank-holiday logic

### Desired precedence

For a target date, work status should be resolved in this order:

1. default baseline
2. weekend or bank-holiday rule
3. applicable manual work-status event for the target date
4. applicable scheduled context for the target date, except on the current date where a valid current work-status event outranks scheduled work status

## Default baseline

If no other source applies, default work status should be:

- `off`

## Weekend and holiday rule

Weekend and holiday rules should set the baseline work status to:

- `off`

This is a baseline rule, not necessarily a terminal rule.

## Manual work-status event rule

Manual work-status events should be considered applicable only if:

- `created_at <= target moment`
- the event has not expired at the target moment, if it has a TTL

When multiple applicable events exist:

- the latest applicable event wins

### Repaired state

Implementation and tests now enforce `created_at <= target moment`.

## Scheduled-context rule

A scheduled-context entry applies only when:

- its date exactly matches `effectiveDate`

Validation rule:

- a scheduled-context entry must contain `workStatus`, `location`, or both
- `reason` alone is not sufficient to create valid scheduled context
- a scheduled-context entry must have a valid controlled source value
- public scheduled-context writes may only create `manual` scheduled context
- scheduled `location` input must include numeric `latitude` and `longitude`
- scheduled `location` input is normalized to `latitude`, `longitude`, and `locationName`

### Work-status field

If a scheduled-context entry contains `workStatus`, it should override lower-precedence work-status sources for that date.

### Verified behavior

- scheduled `workStatus` overrides weekend baseline

Desired rule:

- on the current date, a valid work-status event outranks scheduled work status
- on non-current dates, scheduled work status is authoritative when present
- scheduled work status may override weekend and bank-holiday baseline defaults

## End-state write surface

Desired end state:

- `status_set_work` is the canonical write surface for work-status changes
- `status_set_override` is removed from the end-state product surface
- no resolver or domain semantics should depend on an `override` concept
- public work-status writes remain intent-shaped even though the domain persists **Work-Status Events**

## Location resolution

### Desired sources

Effective location may be influenced by:

- manual location events
- Home Assistant location events
- scheduled context location for a target date, if the product supports planned location

### Desired location precedence

For the current date:

1. latest applicable location event
2. current-day scheduled location

Desired rule:

- on the current date, live location outranks planned location
- scheduled location may still apply when no valid live location exists

For non-current dates:

1. schedule location for that date, if supported
2. otherwise no effective location

Desired rule:

- non-current dates without matching scheduled context must resolve `location` as `null`
- current live or recent location events must not leak into non-current planning queries
- historical raw location events must not be elevated into non-current effective-context location unless scheduled context defines planned location

Non-current work-status rule:

- non-current dates without scheduled context still resolve work status from baseline rules and any applicable historical work-status events
- absence of scheduled context does not create an `unknown` work-status state

## Location event applicability

A location event is applicable only if:

- it has not expired at resolve time
- it is not stale according to `LOCATION_STALE_HOURS`
- it has a valid controlled source value

Initial allowed location sources:

- `manual`
- `homeassistant`

Public write rule:

- public `status_set_location` writes may only create `manual` location events
- `homeassistant` provenance is reserved for integration-owned writes

When multiple applicable location events exist:

- the latest applicable event wins

## Scheduled location

### Product decision

Scheduled location is a real part of effective context.

### Verified behavior

- storage supports scheduled location
- resolver applies scheduled location on the matching date
- live current-date location outranks scheduled location on the current date only

Initial allowed scheduled-context sources:

- `manual`
- `automated`

Public write rule:

- public `status_schedule_set` writes may only create `manual` scheduled context
- `automated` provenance is reserved for system-owned scheduling inputs

## Holiday behavior

Holiday checks should determine whether a target date is a bank holiday for the configured region.

Desired rule:

- holiday truth should be evaluated against data relevant to the target date, not just the current year

### Verified implementation rule

- cache lookups are keyed by the target year being resolved

## Expiry behavior

### Work status

If a work-status event has `expires_at`:

- it is applicable only before expiry

### Location

If a location event has `expires_at`:

- it is applicable only before expiry

## Staleness behavior

Location staleness is independent from TTL expiry.

Desired rule:

- an unexpired location may still be excluded if older than the configured stale window

This is already verified and should be preserved.

Product decision:

- staleness is a hard exclusion rule for effective location

## Non-goals for resolver v1

The resolver does not need to:

- infer movement history from sparse points
- backfill historical effective location for arbitrary dates unless explicitly specified
- support multiple concurrent users

## Current verified behavior snapshot

Verified current behavior:

- default work status is `off`
- weekend and holiday baseline is `off`
- scheduled `workStatus` overrides weekend baseline
- work-status events apply only when valid for the target date or moment
- current-date live location outranks current-date scheduled location when live data is fresh
- scheduled location is used when current-date live location is missing, stale, or expired
- latest non-expired, non-stale current-date location event wins
- location expiry is exclusive at the exact expiry instant
- the stale-window boundary remains inclusive at the exact configured threshold
- non-current dates resolve `location` from matching scheduled context or `null`
- scheduled location participates in effective context on the matching date
- effective-context reads surface `reason`, `workStatusProvenance`, and `locationProvenance`
- effective location reads use the normalized `locationName` field
- public location writes reject non-manual provenance
- public scheduled-context writes reject non-manual provenance and normalize scheduled location payloads

## Repair acceptance criteria

The resolver contract should be considered repaired when:

- temporal correctness is enforced for date-based status queries
- precedence is explicit and tested
- scheduled-location behavior is either implemented or removed from the product contract
- expiry and staleness behavior are covered by automated tests
- docs and implementation match on all public resolver-facing behavior

Current status:

- the resolver contract is repaired and covered for the intended non-live harness surface
