# Reliability

## Reliability goal

The service should produce deterministic, explainable context from a mix of:

- manual writes
- scheduled context
- external integrations
- cached holiday data

## Current verified strengths

- resolver precedence rules are explicit and test-backed
- current-date location freshness, expiry, and scheduled fallback behavior are test-backed
- Home Assistant, Google, and holiday integration success and failure paths degrade predictably through the mocked harness, including malformed Google payloads and invalid Home Assistant coordinates
- direct local storage resolves predictably to `./data/mcp.db`
- health endpoints are reachable and contract-tested

## Current reliability posture

- `59` automated tests protect resolver, tool, runtime, store, integration, and auth behavior
- public provenance boundaries are now test-backed for manual location writes and manual scheduled-context writes

## Current contract

- resolver precedence rules are explicit
- each tool has validated input bounds
- integration failures degrade clearly, not silently
- storage behavior is predictable in every supported runtime mode
- reliability claims are backed by automated tests
