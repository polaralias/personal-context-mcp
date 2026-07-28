---
type: "Product Contract"
title: "Personal Context Service"
description: "Documents Personal Context Service for the personal-context-mcp repository."
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
# Personal Context Service

## Product outcome

Provide one reliable service that answers personal-context questions for agents.

## Supported questions

- what is the effective work status now
- what is the effective work status for a requested date
- what is the effective location now
- what location history exists
- what scheduled context exists
- what holidays affect planning
- what nearby places are relevant to the current or requested location

Direct manual location entry remains part of the intended product surface.

Direct scheduled-context inspection is part of the product surface, not just an internal implementation aid for effective-context resolution.

## Required product qualities

- explicit precedence rules
- validated inputs
- graceful degradation when integrations fail
- deterministic outputs
- operator-visible runtime behaviour
- intent-shaped public writes rather than storage-shaped public writes

## Non-goals

- end-user GUI
- broad identity system
- generalised workflow engine

## Current mismatch to repair

The current service persists more concepts than it reliably resolves. Repair work should narrow that gap until the product contract and runtime behaviour match.

## Repository knowledge

- [Documentation map](../knowledge/documentation-map.md) — RKE-managed reading order and relationship hub.
