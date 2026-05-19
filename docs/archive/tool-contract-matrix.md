# Tool Contract Matrix

Reading rule:

- this matrix captures current verified tool behavior and contract drift
- use `docs/tool-reference.md` for the current human-readable contract summary
- use `docs/product-specs/resolver-spec.md` when end-state product intent matters

This matrix compares the current public tool surface against observed behavior from `server.py` and local execution.

Legend:

- `Verified` means directly checked in code and/or local execution
- `Claim` means the present public-facing description
- `Gap` means the claim and implementation diverge or need tighter wording

## Status tools

### `status_get`

- Claim: resolve effective context for now or a supplied date
- Verified:
  - returns effective date, resolved timestamp, bank-holiday flag, weekend flag, work status, location, and last-updated
  - accepts `YYYY-MM-DD`
  - supplied dates are not historically safe because future-created work events can influence them
- Gap:
  - "for a supplied date" overstates correctness for historical/future resolution

### `status_set_override`

- Claim: apply a temporary override on top of normal work-status rules
- Verified:
  - appends a manual work-status row
  - optional TTL is stored as an expiry timestamp
  - returns the newly resolved current context
- Gap:
  - implementation does not establish a separate override domain from normal work-status writes

### `status_get_work`

- Claim: return only the effective work-status portion
- Verified:
  - returns `workStatus` and `effectiveDate`
  - inherits the same date-resolution weaknesses as `status_get`
- Gap:
  - historical/future trust is weaker than the wording implies

### `status_set_work`

- Claim: store or replace the effective work-status override
- Verified:
  - stores a new row
  - does not replace previous rows
  - returns current effective work status and date
- Gap:
  - "replace" is inaccurate
  - behavior overlaps heavily with `status_set_override`

## Location tools

### `status_get_location`

- Claim: return latest effective location snapshot
- Verified:
  - returns only `location` and `effectiveDate`
  - location is omitted if expired or stale
- Gap:
  - no major mismatch

### `status_set_location`

- Claim: store a manual location override and optionally enrich its display name
- Verified:
  - writes a location event
  - if no `locationName` is supplied, it attempts Google reverse geocoding when configured
  - returns the resolved effective location and date
- Gap:
  - source is caller-controlled and unconstrained

### `status_sync_homeassistant_location`

- Claim: poll Home Assistant immediately and store latest configured device location
- Verified:
  - if HA is not configured, returns `configured: false`, `synced: false`
  - on success, writes a `homeassistant` location event
- Gap:
  - live HA compatibility remains unverified without credentials

### `status_enrich_latest_location`

- Claim: reverse-geocode or enrich the latest stored location
- Verified:
  - only enriches the latest stored location record that has no name
  - returns whether an update occurred
- Gap:
  - wording suggests broader enrichment than the actual "fill missing name" behavior

### `places_nearby`

- Claim: search nearby places around current or supplied coordinates
- Verified:
  - requires Google API configuration
  - uses current resolved location if coordinates are omitted
  - validates rank preference and explicit lat/lon pairing
  - default nearby types are applied when `includedTypes` is omitted
- Gap:
  - live Google Places behavior remains unverified without credentials

### `status_get_location_history`

- Claim: list historical location records over a date-time range
- Verified:
  - returns `events`
  - accepts full ISO timestamps
  - also accepts bare dates
  - negative limits are accepted and can return all rows
- Gap:
  - docs are stricter than implementation on date parsing
  - no lower-bound validation for `limit`

## Schedule tools

### `status_schedule_set`

- Claim: create or replace a scheduled context entry for a specific date
- Verified:
  - upserts a per-date JSON patch
  - accepts `workStatus`, `location`, `reason`
  - accepts an empty payload and stores an empty patch
- Gap:
  - scheduled `location` does not influence effective resolved context
  - empty no-op schedule entries are allowed

### `status_schedule_list`

- Claim: list scheduled entries across an optional date range
- Verified:
  - returns stored schedule rows ordered by date
  - date filtering is lexical on `YYYY-MM-DD`
- Gap:
  - no major mismatch

### `status_schedule_delete`

- Claim: delete a scheduled entry for a specific date
- Verified:
  - deletes by exact date
  - always returns `{"success": true}`
- Gap:
  - does not report whether anything was actually deleted

## Holiday tools

### `holidays_list`

- Claim: fetch public holidays for the requested GOV.UK region
- Verified:
  - fetches and caches region data
  - falls back to cached data on some fetch failures
- Gap:
  - internal cache keying uses the current year, not a requested target year context
  - live network behavior was not fully exercised in this pass
