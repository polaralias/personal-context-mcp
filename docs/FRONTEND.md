---
type: "Design Concept"
title: "Frontend"
description: "Documents Frontend for the personal-context-mcp repository."
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
# Frontend

This repository does not currently contain a frontend.

Implications:

- no browser UI is part of the product contract
- no design system is currently required for runtime delivery
- future UI work, if introduced, should be treated as a separate product surface

If a frontend is ever added, it should consume the same tested service contracts documented in the product specs rather than inventing parallel semantics.

## Repository knowledge

- [Documentation map](knowledge/documentation-map.md) — RKE-managed reading order and relationship hub.
