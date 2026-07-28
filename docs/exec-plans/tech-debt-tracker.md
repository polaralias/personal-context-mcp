---
type: "Delivery Plan"
title: "Tech Debt Tracker"
description: "Documents Tech Debt Tracker for the personal-context-mcp repository."
timestamp: 2026-07-28T21:55:36Z
authority: canonical
verification: untested
owner: polaralias
tags:
  - personal-context-mcp
  - delivery-plan
navigation:
  role: supporting
  order: 100
---
# Tech Debt Tracker

## High

- None currently tracked.

## Medium

- None currently tracked for the repaired documentation surface.

## Low

- `server.py` remains a single large module; further structural split is optional follow-on work rather than a contract repair requirement.

## Rule

Debt stays in this tracker until one of the following is true:

- repaired in code and tests
- intentionally accepted and documented
- removed from the public contract

## Repository knowledge

- [Documentation map](../knowledge/documentation-map.md) — RKE-managed reading order and relationship hub.
