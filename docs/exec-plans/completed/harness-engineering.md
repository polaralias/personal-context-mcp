---
type: "Delivery Plan"
title: "Harness Engineering"
description: "Documents Harness Engineering for the personal-context-mcp repository."
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
# Harness Engineering

## Outcome

Create a documentation and development harness that makes future repair work faster, safer, and more legible.

## Scope

- rewrite repository entry docs
- create forward-looking architecture, product, security, and reliability docs
- preserve investigation evidence docs
- add execution-plan and debt-tracking structure
- add generated schema documentation

## Success criteria

- a new contributor can tell the difference between current truth and desired end state
- execution plans have a stable home
- major risks are visible before code changes start
- a light prompt of `follow AGENTS.md and use tdd` is enough to find the domain language, contract, and first test target without extra briefing

## Current status

- completed

## Follow-on dependency

This plan should feed directly into contract hardening and test planning.

## Repository knowledge

- [Documentation map](../../knowledge/documentation-map.md) — RKE-managed reading order and relationship hub.
