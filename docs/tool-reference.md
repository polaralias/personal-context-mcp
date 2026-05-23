# Tool Reference

This file describes the current tested MCP tool surface.

Use `GLOSSARY.md` for canonical domain language and `docs/product-specs/resolver-spec.md` for resolver semantics.

## Status tools

### `status_get`

Returns effective context for now or a requested date.

Parameters:

- `date` optional `YYYY-MM-DD`

Returned effective context includes:

- `effectiveDate`
- `resolvedAt`
- `bankHoliday`
- `weekend`
- `workStatus`
- `location`
- `reason`
- `workStatusProvenance`
- `locationProvenance`
- `lastUpdated`

`location` is either `null` or an object with:

- `latitude`
- `longitude`
- `locationName`
- `source` when the winning location came from a live location event
- `timestamp` when the winning location came from a live location event

### `status_get_work`

Returns the effective work-status slice for now or a requested date.

Parameters:

- `date` optional `YYYY-MM-DD`

### `status_set_work`

Appends a work-status event and returns the current effective work-status slice.

Parameters:

- `workStatus` required string
- `reason` optional string
- `ttlSeconds` optional integer

## Location tools

### `status_get_location`

Returns the current effective location slice.

Return shape:

- `location` `null` or the normalized effective-location object described above
- `effectiveDate`

### `status_set_location`

Stores a location event and, when Google is configured, may enrich the name automatically.

Parameters:

- `latitude` required number
- `longitude` required number
- `locationName` optional string
- `source` optional string, default `manual`
- `ttlSeconds` optional integer

Rules:

- public writes create manual location events only
- integration-owned writes such as Home Assistant may still create `homeassistant` provenance

Return shape:

- `location` normalized effective-location object
- `effectiveDate`

### `status_sync_homeassistant_location`

Polls Home Assistant immediately and stores the result when configured.

Return shape:

- `configured`
- `synced`
- `record`
- `location`
- `effectiveDate`

### `status_enrich_latest_location`

Attempts to enrich the latest stored nameless location record using Google.

Return shape:

- `configured`
- `updated`
- `record`
- `location`
- `effectiveDate`

### `places_nearby`

Searches nearby places using explicit coordinates or the current effective location.

Parameters:

- `latitude` optional number
- `longitude` optional number
- `radiusMeters` optional integer, default `500`
- `maxResults` optional integer, default `5`
- `includedTypes` optional string array
- `rankPreference` optional string, default `POPULARITY`

Return shape:

- `places` normalized nearby-place results
- `search` normalized request summary
- `origin` chosen search origin and source
- `defaultsApplied` boolean indicating whether default place types were used

### `status_get_location_history`

Returns stored location events over an optional range.

Parameters:

- `from` optional ISO 8601 timestamp or bare date
- `to` optional ISO 8601 timestamp or bare date
- `limit` optional integer, default `50`, minimum `1`

## Schedule tools

### `status_schedule_set`

Upserts scheduled context for one date.

Parameters:

- `date` required `YYYY-MM-DD`
- `workStatus` optional string
- `location` optional object with numeric `latitude`, numeric `longitude`, and optional `locationName`
- `reason` optional string
- `source` optional string, default `manual`

Rules:

- the payload must include `workStatus`, `location`, or both
- `reason` is explanatory only
- public writes create manual scheduled context only
- `automated` scheduled-context provenance is reserved for system-owned scheduling inputs
- scheduled `location` is normalized to `latitude`, `longitude`, and `locationName`
- scheduled `location` participates in effective resolved context on the matching date

### `status_schedule_list`

Lists scheduled context entries across an optional date range.

Parameters:

- `from` optional `YYYY-MM-DD`
- `to` optional `YYYY-MM-DD`

### `status_schedule_delete`

Deletes scheduled context for one date.

Parameters:

- `date` required `YYYY-MM-DD`

Return shape:

- `success` boolean

## Holiday tool

### `holidays_list`

Returns GOV.UK bank-holiday data for a region.

Parameters:

- `region` optional string, default `england-and-wales`
