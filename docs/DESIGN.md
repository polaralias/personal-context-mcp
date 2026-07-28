---
type: "Design Concept"
title: "Design"
description: "Documents Design for the personal-context-mcp repository."
timestamp: 2026-07-28T21:55:36Z
authority: canonical
verification: untested
owner: polaralias
tags:
  - personal-context-mcp
  - design-concept
navigation:
  role: supporting
  order: 100
---
# Design

## Purpose

This repository should evolve towards a service that is:

- explicit about contract
- narrow in scope
- predictable for agents
- easy to test locally

## Design priority order

1. correctness
2. clarity
3. operability
4. refactorability

## Design constraint

Do not design around the current single-file implementation. Design around the desired product contract, then bring implementation into line with it.

## Repository knowledge

- [Documentation map](knowledge/documentation-map.md) — RKE-managed reading order and relationship hub.
