---
type: "Security Boundary"
title: "Auth Principles"
description: "Documents Auth Principles for the personal-context-mcp repository."
timestamp: 2026-07-28T21:55:36Z
authority: canonical
verification: untested
owner: polaralias
tags:
  - personal-context-mcp
  - security-boundary
navigation:
  role: foundational
  order: 20
---
# Auth Principles

## Goal

Authentication should be intentionally simple:

- public health
- protected MCP
- explicit disable mode for local-only or controlled scenarios

## Current contract

The auth model should satisfy:

- bearer-token protection on every MCP request when enabled
- a precise statement of which environment variables are active
- no dead config pretending to be security
- health output that accurately reflects active auth posture

## Current verified reality

- bearer-token auth works
- disable mode exists
- multiple key sources exist
- `/mcp` remains protected when auth is not explicitly disabled
- health output reports `bearer-token`, `disabled`, or `unconfigured` precisely
- inactive security-adjacent knobs are no longer surfaced in health output

## Ongoing rule

- keep the simple auth model
- remove or implement inactive security-adjacent knobs
- document auth as a real product contract, not an implementation detail

## Repository knowledge

- [Documentation map](../knowledge/documentation-map.md) — RKE-managed reading order and relationship hub.
