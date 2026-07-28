---
type: "Historical Evidence"
title: "Investigation Report"
description: "Documents Investigation Report for the personal-context-mcp repository."
timestamp: 2026-07-28T21:55:36Z
authority: evidence
verification: untested
owner: polaralias
tags:
  - personal-context-mcp
  - historical-evidence
navigation:
  role: reference
  order: 200
---
# Investigation Report

> Historical evidence note:
> This document captures validated findings from the investigation phase and includes issues that may already be repaired.
> Use it as evidence, not as the active contract source.

## Scope

Reading rule:

- this is an evidence document for current verified behaviour during investigation
- for current domain language and desired contract, start with `GLOSSARY.md`, `docs/product-specs/resolver-spec.md`, and `docs/exec-plans/active/test-plan.md`

This report covers the follow-up investigations that can be completed without live third-party credentials:

- resolver correctness
- public tool contract verification
- runtime and auth wiring
- deployment/config drift
- testability and verification gaps

No production code was changed during this pass. Only documentation artefacts were added.

## Credentials requirement

Credentials are **not required yet** for the completed portion of this investigation.

Credentials would only be needed for live validation of:

- Home Assistant polling against a real instance
- Google reverse geocoding
- Google Nearby Search

Everything else in this report was verified locally from code inspection and local execution against in-memory SQLite stores.

Update after live validation:

- Home Assistant live validation is now complete
- Google live validation was attempted and reached the external APIs, but the supplied key was rejected as expired
- MCP HTTP auth behaviour was live-validated locally against a running server instance
- Google success-path validation is now complete after enabling the required APIs on a fresh key

## Method

Verification techniques used:

- direct code review of `server.py`, `scripts/run_server.py`, and runtime manifests
- import-time validation of the module
- local execution of resolver and store behaviour against `:memory:` SQLite databases
- targeted monkeypatching of module globals to exercise public tool functions without mutating a persistent local database

## Verified findings

### 1. The core architecture is real and coherent

The service is not vaporware. The following are genuinely implemented:

- FastMCP server creation
- bearer-token verification through static API keys
- SQLite persistence
- background threads for polling/backfill/cleanup
- tool registration for 14 public tools

This matters because the next hardening phase can be incremental rather than a rewrite.

### 2. Historical date resolution is not trustworthy

Verified behaviour:

- querying a past date can still pick up a work-status event created later in time

Reason:

- `latest_valid_work_event()` filters only on expiry, not on `created_at <= target`

Impact:

- `status_get(date=...)` and `status_get_work(date=...)` are not reliable historical views
- future-date resolution is also weak for the same reason

Relevant code:

- `server.py:852`-`863`
- `server.py:1083`-`1107`

### 3. Scheduled location is persisted but not resolved

Verified behaviour:

- `status_schedule_set()` accepts and stores a `location`
- `StatusResolver.resolve()` ignores scheduled `location`
- effective location still comes from the latest non-stale location event

Impact:

- the public schedule shape implies a feature that does not affect resolved context

Relevant code:

- `server.py:915`-`948`
- `server.py:1099`-`1102`
- `server.py:1410`-`1418`

### 4. Weekend overrides are allowed by schedule

Verified behaviour:

- a scheduled `workStatus` overrides the built-in weekend `"off"` rule

Impact:

- this is an intentional-looking precedence rule and should be documented as such
- if the intended product model is "weekends are always off", the current implementation does not enforce that

Relevant code:

- `server.py:1096`-`1102`

### 5. Temporary location TTL works, and stale filtering works

Verified behaviour:

- a location with a short TTL disappears from resolved context once expired
- resolved location is omitted when expired or stale

Impact:

- this is one of the few places where the "effective context" model behaves predictably and is worth preserving

Relevant code:

- `server.py:783`-`816`
- `server.py:1110`-`1119`

### 6. `status_set_override` and `status_set_work` are not meaningfully distinct

Verified behaviour:

- both write a new row into `work_status_events`
- neither replaces an existing row
- multiple writes accumulate history

Impact:

- current naming suggests two concepts, but implementation provides one append-only event log with two entry points
- `status_set_work` documentation says "store or replace", but it only stores

Relevant code:

- `server.py:757`-`781`
- `server.py:1253`-`1275`

### 7. Schedule entries can be empty no-ops

Verified behaviour:

- `status_schedule_set(date=...)` with no `workStatus`, `location`, or `reason` stores an empty `{}` patch

Impact:

- empty schedule rows add state without changing behaviour
- this increases ambiguity when auditing repository data or debugging client behaviour

Relevant code:

- `server.py:922`-`931`
- `server.py:1410`-`1418`

### 8. `status_get_location_history` accepts looser inputs than documented

Verified behaviour:

- docs say `from` and `to` expect full ISO 8601 timestamps
- implementation accepts bare dates like `2026-05-13`

Impact:

- the docs are stricter than the code
- consumers may treat this as supported behaviour even though it is undocumented

Relevant code:

- `server.py:78`-`88`
- `server.py:1384`-`1406`

### 9. Negative history limits are accepted

Verified behaviour:

- `status_get_location_history(limit=-1)` returns all inserted rows in the local validation case

Reason:

- the tool does not validate lower bounds
- SQLite accepts negative `LIMIT` values in a permissive way

Impact:

- a supposedly bounded API can become effectively unbounded
- this matters for public API hardening and abuse resistance

Relevant code:

- `server.py:898`-`913`
- `server.py:1384`-`1406`

### 10. Default database-path claims are inaccurate

Verified behaviour:

- `_resolve_database_path()` defaults to `sqlite:///data/mcp.db`
- that resolves to `C:\\data\\mcp.db` on this Windows machine
- the code path also implies `/data/mcp.db` in Unix-style environments

Impact:

- local default persistence is not under the repository
- README claims about `./state/data` are not true for direct local runs
- `docker-compose.yml` mounts `./state/data` to `/app/data`, but the default configured path is `/data/mcp.db`, so the documented persistence story appears inconsistent

Relevant code and config:

- `server.py:91`-`117`
- `fastmcp.json:20`
- `docker-compose.yml:14`-`15`
- `README.md:10`
- `README.md:62`

### 11. Several auth/rate-limit variables are documentary residue

Verified behaviour:

- settings such as `MASTER_KEY`, code/token TTLs, and rate-limit knobs appear in docs and health payloads
- no active behaviour was found that enforces or uses them beyond exposing values in health output

Impact:

- the operational story currently overstates what the service actually does
- this is a public-repo credibility risk

Relevant code:

- `server.py:1165`-`1200`
- `docs/configuration.md`
- `fastmcp.json`

### 12. Test suite is absent

Verified behaviour:

- no automated tests were found in the repository

Impact:

- there is no executable contract for the resolver, which is the product core
- any future cleanup or refactor would currently be blind

### 13. Home Assistant integration is live and functioning

Verified behaviour:

- the supplied Home Assistant settings produce a configured connector
- polling `person.james` succeeds
- the connector returns coordinates and a state-derived name of `home`
- the public tool-layer path `status_sync_homeassistant_location()` also succeeds and resolves the same location into effective context

Observed result during validation:

- approximate location returned successfully
- tool output was internally consistent between raw record and resolved location

Impact:

- the HA surface is not just wired; it works against a real instance
- this is now one of the better-validated parts of the system

### 14. Google integration code path is live, but the supplied key is expired

Verified behaviour:

- reverse geocoding reaches Google and fails with an expired-key error
- Nearby Search reaches Google Places and fails with an expired-key error
- `status_set_location()` still succeeds when enrichment fails, but leaves `location_name` as `null`
- `status_enrich_latest_location()` returns `updated: false` rather than crashing

Impact:

- the Google request path and error handling are real
- successful enrichment remains unverified until a valid key is supplied
- current behaviour on Google failure is serviceable and non-fatal for location writes

Update after second live key:

- a fresh key was also tested
- reverse geocoding then failed because the required Google Maps API was not enabled on the project
- Nearby Search then failed because `places.googleapis.com` was disabled or not yet activated

Refined conclusion:

- the blocker is now clearly Google project/API enablement, not uncertainty in the application code path

Final update after API enablement:

- reverse geocoding succeeded
- Nearby Search succeeded
- `status_set_location()` auto-populated a location name through Google enrichment
- `status_enrich_latest_location()` updated a nameless stored record successfully

Final conclusion:

- the Google integration is now verified end-to-end on both failure and success paths

### 15. MCP auth is enforced on the live HTTP endpoint

Verified behaviour:

- `GET /health` returns `200` without auth
- `POST /mcp` without auth returns `401`
- `POST /mcp` with the supplied bearer token passes auth and proceeds far enough to fail later with `406` due to request-shape/content negotiation rather than authentication

Impact:

- bearer-token protection on the MCP endpoint is functioning
- the docs are directionally correct that auth gates the MCP surface
- the health payload string `static-or-disabled` is vague and not a precise description of the active auth state

### 16. Holiday live fetch works, but the cache model is conceptually odd rather than immediately broken

Verified behaviour:

- live GOV.UK holiday fetch succeeds
- returned region payload includes many years of events, not only the current year
- `is_bank_holiday()` returned `True` for `2026-12-25` during validation

Impact:

- the earlier year-keying concern still indicates a weak cache model
- however, it is less immediately breaking than first feared because the upstream payload currently includes multi-year data

## Risk ranking

### High

- default database path and compose persistence mismatch
- historical/future work-status resolution is temporally unsound
- scheduled location contract is misleading

### Medium

- duplicate semantics between `status_set_override` and `status_set_work`
- negative history limits accepted
- empty schedule patches allowed
- documentary config residue around auth and rate limits

### Low

- docs stricter than code for date parsing in location-history filters

## What remains unverified

These require credentials or network-dependent fixture work:

- GOV.UK holiday API behaviour across year boundaries if the upstream payload format changes

## Recommended next hardening order

1. Lock down the runtime contract.
   Clarify where the database actually lives in local and container runs.

2. Lock down resolver semantics.
   This is the product core and currently the weakest logic contract.

3. Lock down tool contracts.
   Narrow or document inputs and outputs to match the real implementation.

4. Add resolver-first tests.
   The first test suite should cover date precedence, TTLs, stale location, and schedule behaviour.

5. Only then validate integrations with live credentials.
   That avoids spending time verifying external APIs before the internal contract is stable.

## Repository knowledge

- [Documentation map](../knowledge/documentation-map.md) — RKE-managed reading order and relationship hub.
