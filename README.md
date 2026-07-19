<p align="center">
  <img src="Personal%20Context%20MCP.png" alt="Personal Context MCP banner" width="960" />
</p>

# Personal Context MCP

Personal Context MCP is a FastMCP service that exposes personal status, location, schedule, holiday, and nearby-place context to agents.

## What It Does

The service combines several context sources into a single MCP surface so downstream agents can answer questions such as where someone is expected to be, whether they are working, what location should currently be treated as effective, and what nearby places or calendar context may matter.

## Core Capabilities

- effective-status and work-status resolution
- scheduled location participation in current context
- local persistence for context state
- holiday lookup and caching
- optional Home Assistant and Google reverse-geocoding integrations
- normalised tool and payload behaviour across context reads and writes

## Endpoints

- MCP: `http://127.0.0.1:3003/mcp`
- Health: `http://127.0.0.1:3003/health`

## Quick Start

```bash
python scripts/run_server.py serve
python scripts/run_server.py doctor
python scripts/run_server.py url
python -m pytest -q
```

## Documentation

Start with:

- [ARCHITECTURE.md](ARCHITECTURE.md)
- [docs/product-specs/index.md](docs/product-specs/index.md)
- [docs/RELIABILITY.md](docs/RELIABILITY.md)

For repository workflow and agent-focussed context, read [AGENTS.md](AGENTS.md).
