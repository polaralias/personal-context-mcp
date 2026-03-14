# Tool Reference

This reference is derived from the FastMCP tool functions defined in `server.py` and covers all 14 tools exposed by the server.

Parameter format notes:
- `required` means the tool call must include the field.
- `default ...` reflects the runtime default applied by the server when the field is omitted.
- Date values use `YYYY-MM-DD` unless a parameter explicitly says it expects a full ISO 8601 timestamp.

## Status Resolution

### `status_get`

Resolve the effective personal context for now or for a supplied date.

- Parameters:
  - `date` | `string` | optional | Date in `YYYY-MM-DD` format. When omitted, the server resolves the current effective status.

### `status_set_override`

Apply a temporary override on top of the normal work-status resolution rules.

- Parameters:
  - `status` | `string` | required | Override status to store immediately.
  - `reason` | `string` | optional | Free-text reason recorded with the override.
  - `ttlSeconds` | `integer` | optional | Optional TTL for the override in seconds.

### `status_get_work`

Return only the effective work-status portion of the resolved context.

- Parameters:
  - `date` | `string` | optional | Date in `YYYY-MM-DD` format. When omitted, the current effective work status is returned.

### `status_set_work`

Store or replace the effective work-status override and return the resolved result.

- Parameters:
  - `workStatus` | `string` | required | Work-status value to persist.
  - `reason` | `string` | optional | Free-text reason recorded with the status entry.
  - `ttlSeconds` | `integer` | optional | Optional TTL for the override in seconds.

## Location

### `status_get_location`

Return the latest effective location snapshot from manual entry, Home Assistant, or stored state.

- Parameters: none

### `status_set_location`

Store a manual location override and optionally enrich its display name with Google APIs.

- Parameters:
  - `latitude` | `number` | required | Latitude for the stored location.
  - `longitude` | `number` | required | Longitude for the stored location.
  - `locationName` | `string` | optional | Optional display name. If omitted, the server may reverse-geocode one.
  - `source` | `string` | optional default `manual` | Source label stored alongside the location record.
  - `ttlSeconds` | `integer` | optional | Optional TTL for the location override in seconds.

### `status_sync_homeassistant_location`

Poll Home Assistant immediately and store the latest configured device location.

- Parameters: none

### `status_enrich_latest_location`

Reverse-geocode or otherwise enrich the latest stored location record using Google APIs.

- Parameters: none

### `places_nearby`

Search nearby places around the current effective location or supplied coordinates.

- Parameters:
  - `latitude` | `number` | optional | Explicit latitude for the search origin. Must be paired with `longitude`.
  - `longitude` | `number` | optional | Explicit longitude for the search origin. Must be paired with `latitude`.
  - `radiusMeters` | `integer` | optional default `500` | Search radius in meters.
  - `maxResults` | `integer` | optional default `5` | Maximum number of places to return.
  - `includedTypes` | `array<string>` | optional | Optional Google Places types to include. When omitted, the server applies its default curated list.
  - `rankPreference` | `string` | optional default `POPULARITY` | Ranking mode. Supported values are `POPULARITY` and `DISTANCE`.

### `status_get_location_history`

List historical location records over a date-time range.

- Parameters:
  - `from` | `string` | optional | Inclusive start timestamp in ISO 8601 format.
  - `to` | `string` | optional | Inclusive end timestamp in ISO 8601 format.
  - `limit` | `integer` | optional default `50` | Maximum number of events to return.

## Schedule

### `status_schedule_set`

Create or replace a scheduled context entry for a specific date.

- Parameters:
  - `date` | `string` | required | Date in `YYYY-MM-DD` format.
  - `workStatus` | `string` | optional | Scheduled work-status value for that date.
  - `location` | `object` | optional | Optional structured location object stored against the scheduled date.
  - `reason` | `string` | optional | Free-text explanation for the scheduled entry.

### `status_schedule_list`

List scheduled context entries across an optional date range.

- Parameters:
  - `from` | `string` | optional | Inclusive start date in `YYYY-MM-DD` format.
  - `to` | `string` | optional | Inclusive end date in `YYYY-MM-DD` format.

### `status_schedule_delete`

Delete a scheduled context entry for a specific date.

- Parameters:
  - `date` | `string` | required | Date in `YYYY-MM-DD` format.

## Holidays

### `holidays_list`

Fetch public holidays for the requested GOV.UK holiday region.

- Parameters:
  - `region` | `string` | optional default `england-and-wales` | Holiday region slug such as `england-and-wales`, `scotland`, or `northern-ireland`.
