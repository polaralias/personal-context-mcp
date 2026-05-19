# personal-context-mcp

`personal-context-mcp` is a Python FastMCP service that exposes personal status, location, schedule, holiday, and nearby-place context to agents.

This repository is in a contract-first repaired state. The implementation is real, the highest-risk resolver and tool behaviors are covered by automated tests, and the active docs are intended to describe tested behavior rather than investigation-era assumptions.

## Current status

Verified today:

- HTTP MCP server works
- `/mcp` stays protected unless auth is explicitly disabled
- health output reports precise auth posture without dead security knobs
- temporal work-status resolution is date-correct
- scheduled location participates in effective context
- effective location reads use a normalized `locationName` shape
- public location writes are manual-only while Home Assistant provenance remains system-owned
- scheduled-context writes enforce non-empty payloads, manual-only public provenance, and normalized location payloads
- invalid location and scheduled-context sources are rejected
- default local persistence resolves to `./data/mcp.db`
- holiday lookup uses the target year's cached data
- mocked Home Assistant success, missing-data, and invalid-coordinate paths pass
- mocked Google reverse geocoding success, failure, malformed-payload, and Nearby Search paths pass
- mocked GOV.UK holiday fetch cache-write and fallback paths pass
- `59` automated resolver, store, tool, runtime, integration, and auth tests pass

Optional follow-on refactor:

- `server.py` is still a single large module, but the remaining structural split is no longer a contract repair blocker

## Start here

- `CONTEXT.md`
- `ARCHITECTURE.md`
- `AGENTS.md`
- `docs/PLANS.md`
- `docs/SECURITY.md`
- `docs/RELIABILITY.md`

For repair work:

- use `CONTEXT.md` for domain language
- use `docs/product-specs/resolver-spec.md` for the active resolver contract
- use `docs/exec-plans/active/test-plan.md` for the current harness scope and remaining gaps
- use evidence docs to verify current behavior, not to redefine the intended product contract silently

## Product and design docs

- `docs/product-specs/index.md`
- `docs/design-docs/index.md`
- `docs/generated/db-schema.md`

## Historical archive

Investigation-era evidence stays in the repo under `docs/archive/`, separate from the active contract docs.

- `docs/archive/investigation-report.md`
- `docs/archive/live-validation.md`
- `docs/archive/tool-contract-matrix.md`
- `docs/archive/refactor-repair-plan.md`
- `docs/archive/codebase-map.md`

## Local runtime

Useful commands:

```bash
python scripts/run_server.py doctor
python scripts/run_server.py url
python scripts/run_server.py serve
python -m pytest -q
```

Current default endpoints:

- MCP: `http://127.0.0.1:3003/mcp`
- Health: `http://127.0.0.1:3003/health`

## Current caution

Historical investigation docs remain valuable evidence, but some of their problem statements describe pre-repair behavior. Prefer the root docs, active product spec, and passing test suite when deciding current repository truth.
