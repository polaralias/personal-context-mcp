---
type: "Architecture Concept"
title: "Architecture"
description: "Documents Architecture for the personal-context-mcp repository."
timestamp: 2026-07-28T21:55:36Z
authority: canonical
verification: untested
owner: polaralias
tags:
  - personal-context-mcp
  - architecture-concept
navigation:
  role: foundational
  order: 20
---
# Architecture

## System shape

`personal-context-mcp` is a machine-facing context service for agents.

Its job is to answer:

- what is the current effective work state
- what is the current effective location
- what is planned for a given date
- what supporting context exists around holidays and nearby places

## Runtime model

The current implementation is a single FastMCP server in `server.py`.

Major subsystems:

- transport and auth
- SQLite persistence
- status resolver
- Google enrichment
- Home Assistant polling
- background cleanup and refresh jobs
- MCP tool registration

## Desired target shape

The long-term architecture should separate:

- configuration
- persistence
- domain resolution
- external integrations
- transport and tool surface

The repository is not there yet. The current goal is to define and test the contract before structural split work begins.

## Core domain objects

Current persisted concepts:

- work status event
- location event
- schedule patch
- holiday cache entry

Current computed concept:

- effective personal context

## Source of truth

Today, no single file is a full trustworthy spec.

Use this hierarchy:

1. verified live behaviour and investigation docs
2. explicit product and design specs under `docs/`
3. implementation

When docs and implementation conflict, treat the conflict as work to resolve, not as a reason to assume either side is correct.

## Repository knowledge

- [Documentation map](docs/knowledge/documentation-map.md) — RKE-managed reading order and relationship hub.
