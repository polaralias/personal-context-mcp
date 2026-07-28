---
type: "Product Contract"
title: "Auth Surface"
description: "Documents Auth Surface for the personal-context-mcp repository."
timestamp: 2026-07-28T21:55:36Z
authority: canonical
verification: untested
owner: polaralias
tags:
  - personal-context-mcp
  - product-contract
navigation:
  role: foundational
  order: 20
---
# Auth Surface

## Goal

Protect machine-facing context operations with a simple bearer-token model.

## Public endpoints

- `/health`
- `/healthz`
- `/`

These may remain public if intentionally documented as operational endpoints only.

## Protected endpoint

- `/mcp`

## Desired contract

- MCP requests require a valid bearer token whenever auth is enabled
- accepted token sources are documented and finite
- disable mode exists only as an explicit, visible unsafe option
- health responses clearly reflect whether auth is active

## Current verified state

- protected MCP auth works
- public health routes work
- `/mcp` remains protected when auth is not explicitly disabled, including the no-keys `unconfigured` state
- health responses surface precise auth posture as `bearer-token`, `disabled`, or `unconfigured`
- the auth model is simple enough to keep

## Repository knowledge

- [Documentation map](../knowledge/documentation-map.md) — RKE-managed reading order and relationship hub.
