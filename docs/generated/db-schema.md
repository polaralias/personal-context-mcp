# Database Schema

This document reflects the current verified schema defined in `server.py`.

## `work_status_events`

Purpose:

- stores manual work-status writes and TTL-based status events

Columns:

- `id` integer primary key autoincrement
- `created_at` integer not null
- `source` text not null
- `status` text not null
- `reason` text nullable
- `expires_at` integer nullable

Indexes:

- `work_status_events_created_at_idx` on `created_at`

## `location_events`

Purpose:

- stores manual and integration-derived location events

Columns:

- `id` integer primary key autoincrement
- `created_at` integer not null
- `source` text not null
- `lat` real not null
- `lon` real not null
- `name` text nullable
- `expires_at` integer nullable

Indexes:

- `location_events_created_at_idx` on `created_at`

## `scheduled_status`

Purpose:

- stores one JSON patch per date

Columns:

- `date` text primary key
- `patch` text not null
- `created_at` integer not null
- `updated_at` integer not null

## `bank_holidays_cache`

Purpose:

- stores cached holiday payloads by region and year key

Columns:

- `id` integer primary key autoincrement
- `region` text not null
- `year` integer not null
- `payload` text not null
- `fetched_at` integer not null

Constraints:

- unique on `(region, year)`

## Important warning

This is a schema description, not a correctness guarantee. The major contract issues in resolution logic still exist above this persistence layer.
