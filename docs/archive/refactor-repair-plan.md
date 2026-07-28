---
type: "Historical Evidence"
title: "Refactor And Repair Plan"
description: "Documents Refactor And Repair Plan for the personal-context-mcp repository."
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
# Refactor And Repair Plan

> Historical planning note:
> This plan originated before later repair work and may reference pre-repair gaps that are now closed.
> Cross-check active truth in `README.md`, `GLOSSARY.md`, `docs/product-specs/resolver-spec.md`, `docs/tool-reference.md`, and `docs/exec-plans/active/test-plan.md`.

## Purpose

This document converts the repository investigation into an execution plan for repair and refactor work.

It is intentionally grounded in verified behaviour, not intent:

- documents are treated as claims
- code is treated as implementation that may or may not honour those claims
- live integrations are treated as verified only where exercised directly

This plan does **not** prescribe immediate rewriting. It defines the order in which the repository should be made trustworthy.

## Status Update

This document is still useful as a historical execution record, but several of its highest-risk repair items are now closed in code and tests.

Completed since the investigation phase:

- temporal correctness is enforced for work-status resolution
- scheduled location participates in effective context
- scheduled-context writes reject reason-only payloads and invalid sources
- location writes reject invalid sources
- `status_set_override` is removed from the exported tool inventory
- default direct-run storage resolves to `./data/mcp.db`
- target-year holiday cache lookup is enforced
- a pytest suite covers resolver, tool, runtime, and auth contracts

Use the sections below as historical reasoning for why the repairs were needed, not as the current statement of open defects.

Current reading rule:

- use this document for repair ordering and risk prioritisation
- use `GLOSSARY.md`, `docs/product-specs/resolver-spec.md`, and `docs/exec-plans/active/test-plan.md` as the current contract harness

Related investigation artefacts:

- `docs/codebase-map.md`
- `docs/tool-contract-matrix.md`
- `docs/investigation-report.md`
- `docs/live-validation.md`

## 1. Verified Functionality

These capabilities are validated either by direct code inspection, local execution, or live external validation.

### Core server and transport

Verified:

- the repository contains one real FastMCP server implementation in `server.py`
- the server starts with HTTP transport
- the runtime helper in `scripts/run_server.py` works for `serve`, `doctor`, and `url`
- health endpoints respond without auth
- MCP endpoint auth is enforced with bearer tokens

Evidence:

- local module import succeeded
- `python scripts/run_server.py doctor` worked
- live HTTP validation returned `200` on `/health`, `401` on unauthenticated `/mcp`

### Persistence and state model

Verified:

- SQLite persistence is real
- schema is created automatically
- event storage exists for work status and location
- date-based schedule storage exists
- holiday response caching exists

Primary implementation:

- `work_status_events`
- `location_events`
- `scheduled_status`
- `bank_holidays_cache`

### Resolver behaviour

Verified:

- effective work status is derived from stored work events, weekends, holidays, and schedule patches
- effective location is derived from the latest non-expired, non-stale location event
- location TTL behaviour works
- stale-location suppression works
- scheduled `workStatus` overrides weekend defaults

Important note:

- this describes what the resolver currently does, not necessarily what it should do

### MCP tool surface

Verified:

- the server exports 14 tools
- the tool inventory documented in `docs/tool-reference.md` matches the actual count
- tool-layer behaviour was locally exercised for status, schedule, location history, HA sync, and Google enrichment

### Home Assistant integration

Verified live:

- configured connector works against the provided HA instance
- polling `person.james` succeeded
- coordinates and state-derived name were stored successfully
- `status_sync_homeassistant_location()` returns a coherent record and resolved location

### Google integration

Verified live:

- reverse geocoding works when the required API is enabled
- Places Nearby Search works when the required API is enabled
- error handling is correct on failure paths
- `status_set_location()` auto-populates `location_name` through reverse geocoding
- `status_enrich_latest_location()` updates nameless stored records successfully

### Holiday integration

Verified live:

- GOV.UK holiday fetch works
- holiday data is cached
- bank-holiday checks returned expected truth for Christmas Day 2026 during validation

## 2. Validated Problems And Risks

These are real repository issues, not speculative style concerns.

### High-priority functional issues

#### 1. Historical and future work-status resolution is temporally unsound

Validated issue:

- a work-status event created later can affect `status_get(date=...)` for earlier dates

Why:

- lookup checks expiry but does not constrain event creation time to be on or before the target date

Impact:

- date-based status resolution cannot be treated as trustworthy history
- future-date queries are also weak

Repair goal:

- define correct temporal semantics and enforce them in resolver queries and tests

#### 2. Scheduled location is stored but ignored

Validated issue:

- schedule entries accept a `location` object
- resolver never uses scheduled location when resolving effective context

Impact:

- public contract implies more capability than exists
- planned location context is not real despite being persisted

Repair goal:

- implement scheduled-location resolution to match the desired product contract
- if scope changes later, change the product spec first rather than narrowing the contract implicitly in code

#### 3. Runtime persistence contract is inconsistent

Validated issue:

- docs imply persistence under `./state/data`
- actual default path resolution points to `sqlite:///data/mcp.db`
- on this Windows machine that resolved to `C:\data\mcp.db`
- compose mounts `./state/data` to `/app/data`, which does not clearly match the configured default DB path

Impact:

- local and container persistence behaviour is not clearly trustworthy
- operators may think data is durable when it is not in the path they expect

Repair goal:

- define one explicit storage contract for local runs and one for containers
- align code, compose, docs, and examples

### Medium-priority contract issues

#### 4. `status_set_override` and `status_set_work` are effectively the same operation

Validated issue:

- both append to the same table
- neither replaces previous values

Impact:

- tool naming overstates conceptual separation
- docs are misleading where they say "replace"

Repair goal:

- preserve `status_set_work` as the canonical end-state write surface
- treat `status_set_override` as legacy surface to remove once tests protect the intended contract

#### 5. Empty schedule patches are allowed

Validated issue:

- `status_schedule_set(date=...)` with no payload stores an empty `{}` patch

Impact:

- repository state can contain no-op schedule entries
- debugging schedule behaviour becomes noisier

Repair goal:

- reject empty patches or define a clear use for them

#### 6. Negative history limits are accepted

Validated issue:

- `status_get_location_history(limit=-1)` can act as effectively unbounded

Impact:

- weak API input contract
- unnecessary abuse/performance risk

Repair goal:

- validate lower and upper bounds consistently

#### 7. Health payload overstates active operational controls

Validated issue:

- health output reports code TTLs, token TTLs, issue limits, and MCP rate-limit values
- no corresponding enforcement behaviour was found

Impact:

- operational posture appears stronger than implementation supports

Repair goal:

- either remove inactive knobs or implement them

### Low-priority but real issues

#### 8. Docs are stricter than code on location-history date parsing

Validated issue:

- docs say full ISO 8601 timestamps
- implementation also accepts bare dates

Repair goal:

- either document the looser behaviour or validate more strictly

#### 9. Holiday cache model is awkward

Validated issue:

- cache entries are keyed by current year
- upstream payload currently spans many years, which masks the problem

Impact:

- current implementation works under the present upstream shape, but the model is weak

Repair goal:

- key cache behaviour to explicit data semantics rather than today’s upstream accident

## 3. Current Specs And Docs

### Available repository docs

- `GLOSSARY.md`
- `README.md`
- `docs/configuration.md`
- `docs/tool-reference.md`
- `docs/product-specs/resolver-spec.md`
- `docs/exec-plans/active/test-plan.md`
- `docs/codebase-map.md`
- `docs/tool-contract-matrix.md`
- `docs/investigation-report.md`
- `docs/live-validation.md`

### What counts as the current effective spec

At present the desired contract is documented, but not yet enforced in code and tests.

Use this hierarchy:

1. `GLOSSARY.md` for domain language
2. `docs/product-specs/resolver-spec.md` and `docs/tool-reference.md` for intended repaired behaviour
3. evidence docs for current verified behaviour and known mismatches
4. implementation for current mechanics

### Where the current docs are wrong or invalidated

#### README

Invalidated or misleading points:

- the persistence claim under `./state/data` is not true for direct local default runs
- the compose persistence story is not clearly aligned with the runtime DB path
- "keeps existing location, schedule, retention, and integration behaviours intact" is vague and hides known contract issues

#### Configuration reference

Invalidated or weak points:

- several documented knobs appear to be documentary residue rather than live controls
- `MASTER_KEY`, code/token TTLs, and rate-limit settings are not verified as active behaviour

#### Tool reference

Invalidated or incomplete points:

- `status_set_work` says "store or replace" but only stores
- `status_set_override` implies a distinct override layer that is not materially separate in implementation
- `status_schedule_set` implies scheduled location is meaningful in effective context, but it is not
- `status_get_location_history` docs omit the permissive date parsing and lack of lower-bound validation

### Documentation repair plan

Phase 1:

- update README storage/runtime claims
- mark current tool docs as behaviour-based rather than intent-based
- remove or annotate inactive config knobs

Phase 2:

- rewrite tool docs from tested contracts
- add explicit precedence rules for the resolver
- add a "known limitations" section while repairs are in progress

## 4. Current Test State

### Available tests

Verified:

- there is no automated test suite in the repository
- no `tests/` directory was found
- no pytest or unittest coverage was found

### What currently serves as a test harness

Right now the repository has:

- import-time validation
- manual CLI checks through `scripts/run_server.py`
- live HTTP checks
- ad hoc in-memory verification scripts

This is useful for investigation, but it is not a maintainable test strategy.

### Test quality assessment

Current test quality: `effectively absent`

Implications:

- every future fix risks breaking resolver semantics silently
- refactor safety is near zero
- docs cannot be treated as enforced contracts

### Minimum test suite that should exist before broad refactoring

Priority 1:

- resolver precedence tests
- temporal correctness tests for historical and future dates
- location TTL and stale-window tests
- schedule behaviour tests

Priority 2:

- store-layer query tests
- tool-layer contract tests for validation and return shapes
- auth behaviour tests for `/mcp` versus `/health`

Priority 3:

- integration tests with mocked external services
- optional live smoke tests behind explicit env flags

## 5. Context And Harness Quality For Future Development

### Repository context quality

Strengths:

- small codebase
- one dominant implementation file
- narrow domain
- external integrations are now live-validated

Weaknesses:

- key behaviour is concentrated in one large file
- there is no enforced contract layer between storage, resolver, and tool surface
- docs are partially derived from code but not verified against behaviour
- operational claims exceed implemented controls in some areas

Assessment:

- repository context is understandable enough for safe repair work
- repository context is not yet robust enough for confident refactor work without first adding tests

### Development harness quality

Strengths:

- `scripts/run_server.py` is a usable local entrypoint
- FastMCP config exists
- Dockerfile and compose scaffolding exist
- in-memory SQLite enables lightweight local verification
- external integrations are straightforward to exercise

Weaknesses:

- no formal test runner or fixtures
- no mock integration harness
- no seed data or scenario library
- compose/network assumptions are under-documented
- default DB path behaviour is confusing

Assessment:

- good enough for deliberate repair work
- not good enough for broad, aggressive refactoring

### Public-readiness assessment

For a public portfolio repository, the current harness quality is below the bar because:

- claims are ahead of verified contracts
- no automated tests support the public API
- storage and deployment behaviour are not crisp
- docs do not clearly separate implemented behaviour from intended behaviour

## 6. Repair And Refactor Sequence

This is the recommended execution order.

### Phase 0. Freeze the current truth

Deliverables:

- keep the investigation docs as baseline truth
- do not expand features yet
- use current verified behaviour as the change-control reference

### Phase 1. Repair the contract before structure

Goals:

- fix runtime/storage contract ambiguity
- define resolver precedence rules in writing
- define exact tool semantics in writing
- keep the already-fixed contract decisions visible in root and execution docs

Deliverables:

- revised README
- revised configuration reference
- revised tool reference
- explicit resolver specification document

### Phase 2. Add safety rails

Goals:

- introduce automated tests around the current and intended contracts

Deliverables:

- test harness
- resolver tests
- tool validation tests
- auth and health endpoint tests

Gate:

- no large refactor should begin before this phase is complete

### Phase 3. Functional repairs

Goals:

- correct temporal status resolution
- implement scheduled-location behaviour according to the product contract
- validate inputs consistently
- clean up inactive config residue
- align DB path behaviour across local and container execution

Deliverables:

- repaired behaviour with tests
- docs updated from passing behaviour

### Phase 4. Structural refactor

Only after the contract is tested and the functional gaps are repaired:

- split `server.py` by responsibility
- separate storage, resolver, integrations, and tool registration
- reduce runtime global state
- improve configuration modelling

### Phase 5. Public hardening

Goals:

- make the repository presentable for hiring/public review

Deliverables:

- concise architecture docs
- trustworthy setup instructions
- test instructions
- example usage
- clear limitations and integration requirements

## 7. Immediate Next Actions

If work begins from this plan, the next concrete tasks should be:

1. Translate the resolver specification into the first failing resolver tests, starting with temporal correctness and scheduled-location expectations.
2. Add the minimal formal test harness needed to run Track A and Track C work locally.
3. Repair the storage/runtime contract in code and docs so operators are not misled before broader changes begin.
4. Remove or retire legacy surface that conflicts with the end-state contract only after tests protect the replacement behaviour.

## 8. Definition Of “Ready To Refactor”

This repository should be considered ready for structural refactoring only when:

- storage/runtime behaviour is documented accurately
- resolver semantics are specified explicitly
- automated tests exist for resolver and key tools
- public docs reflect tested behaviour rather than assumptions
- the highest-risk contract issues are repaired or intentionally narrowed

Until then, the correct mode is targeted repair, not open-ended refactor.

## Repository knowledge

- [Documentation map](../knowledge/documentation-map.md) — RKE-managed reading order and relationship hub.
