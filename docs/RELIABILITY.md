---
type: "Reliability Contract"
title: "Reliability"
description: "Documents Reliability for the personal-context-mcp repository."
timestamp: 2026-07-28T21:55:36Z
authority: canonical
verification: untested
owner: polaralias
tags:
  - personal-context-mcp
  - reliability-contract
navigation:
  role: supporting
  order: 100
---
# Reliability

## Reliability goal

The service should produce deterministic, explainable context from a mix of:

- manual writes
- scheduled context
- external integrations
- cached holiday data

## Current verified strengths

- resolver precedence rules are explicit and test-backed
- current-date location freshness, expiry, and scheduled fallback behaviour are test-backed
- Home Assistant, Google, and holiday integration success and failure paths degrade predictably through the mocked harness, including malformed Google payloads and invalid Home Assistant coordinates
- direct local storage resolves predictably to `./data/mcp.db`
- health endpoints are reachable and contract-tested

## Current reliability posture

- `59` automated tests protect resolver, tool, runtime, store, integration, and auth behaviour
- public provenance boundaries are now test-backed for manual location writes and manual scheduled-context writes

## Current contract

- resolver precedence rules are explicit
- each tool has validated input bounds
- integration failures degrade clearly, not silently
- storage behaviour is predictable in every supported runtime mode
- reliability claims are backed by automated tests

## Repository knowledge

- [Documentation map](knowledge/documentation-map.md) — RKE-managed reading order and relationship hub.
