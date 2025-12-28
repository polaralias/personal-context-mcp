# Status MCP Server - Deployment Guide

This guide outlines the phased approach to building and deploying the Status MCP Server. The implementation is divided into four distinct phases to ensure a structured and testable development process.

## Phases

### [Phase 1: Foundation and Core Logic](./phases/phase1_foundation.md)
*   **Goal**: Establish the repository structure, database schema, and core business logic (holidays, status resolution).
*   **Key Deliverables**:
    *   TypeScript/Node.js project scaffolding.
    *   PostgreSQL database with Prisma ORM.
    *   Bank Holiday fetcher and caching.
    *   Status Resolution Engine (pure logic).

### [Phase 2: API and Core Features](./phases/phase2_api_implementation.md)
*   **Goal**: Expose the core logic via a REST API and add persistence for user overrides.
*   **Key Deliverables**:
    *   Express/Fastify API server.
    *   Authentication middleware.
    *   Endpoints for Status, Location, and Scheduling.
    *   Integration of the Resolution Engine with the API.

### [Phase 3: Connectors and Background Jobs](./phases/phase3_connectors_integration.md)
*   **Goal**: Integrate external data sources (Home Assistant, Google) and manage data freshness.
*   **Key Deliverables**:
    *   Home Assistant Poller.
    *   Google Location Poller.
    *   TTL/Expiry management for overrides.

### [Phase 4: Deployment and MCP](./phases/phase4_deployment_mcp.md)
*   **Goal**: Containerize the application and expose it as a Model Context Protocol (MCP) server.
*   **Key Deliverables**:
    *   Dockerfile and Docker Compose.
    *   Smithery/MCP Wrapper.
    *   Observability (Logging, Health Checks).
    *   Final Documentation.

## Getting Started

Begin by reviewing [Phase 1: Foundation](./phases/phase1_foundation.md). Each phase document contains detailed steps, verification instructions, and technical notes.
