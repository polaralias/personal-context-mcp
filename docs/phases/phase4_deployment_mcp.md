# Phase 4: Deployment and MCP

This phase focuses on packaging the application for deployment and exposing it as an MCP server.

## Steps

### 4.1 Dockerization
**Objective**: Create a container image for the service.
**Actions**:
1.  Create `Dockerfile`:
    *   Multi-stage build (build TS -> run node).
    *   Expose port.
2.  Create `docker-compose.yml`:
    *   Service: `status-mcp`.
    *   Service: `postgres` (with persistent volume).
    *   Environment variables configuration.

**Verification**:
*   `docker-compose up --build` brings up the stack.
*   API is accessible on localhost.

### 4.2 MCP Interface (Smithery)
**Objective**: Expose the API as MCP tools.
**Actions**:
1.  Install MCP SDK (if available/needed) or implement the protocol (JSON-RPC over stdio or SSE). *Self-correction: Smithery usually implies a standard way to define tools.*
2.  Implement `src/mcp/server.ts` or adapter layer.
3.  Map "Tools" to internal API functions:
    *   `status_get_now` -> `resolveStatus('now')`
    *   `status_set_override` -> `updateStatus(...)`
    *   etc. (See Section 5 of Plan).
4.  Create `smithery.yaml` or `mcp.json` config.

**Verification**:
*   Test with an MCP client (e.g., Claude Desktop, or a CLI tester).
*   Verify tools appear and function correctly.

### 4.3 Observability
**Objective**: Ensure the system is monitorable.
**Actions**:
1.  **Logging**: Ensure all logs are JSON formatted (using a library like `winston` or `pino`).
2.  **Health Checks**: Ensure `/healthz` checks DB connectivity.

### 4.4 Documentation & Final Polish
**Objective**: Make the project usable by others.
**Actions**:
1.  Generate OpenAPI spec (`openapi.yaml`).
2.  Update `README.md` with:
    *   Setup instructions.
    *   Configuration variables.
    *   Architecture overview.
3.  Final code review and cleanup.

**Verification**:
*   Fresh clone and setup walkthrough.
