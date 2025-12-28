# Phase 3: Connectors and Background Jobs

This phase integrates external systems to automate status updates.

## Steps

### 3.1 Home Assistant Connector
**Objective**: Poll Home Assistant for location/presence.
**Actions**:
1.  Create `src/connectors/homeAssistant.ts`.
2.  Implement polling logic:
    *   `setInterval` or `node-cron`.
    *   Fetch from HA REST API (`/api/states/<entity_id>`).
    *   Extract state/attributes (lat/lon).
    *   If changed (or periodically), save to `LocationEvent` table with `source='homeassistant'`.
3.  Configuration: `HA_URL`, `HA_TOKEN`, `HA_ENTITY_ID`, `POLL_INTERVAL`.

**Verification**:
*   Mock HA API.
*   Run the poller and verify entries appear in the database.

### 3.2 Google Location Connector
**Objective**: Poll Google Location History (if using) or similar fallback.
**Actions**:
1.  Create `src/connectors/google.ts`.
2.  Implement polling logic (similar to HA but likely lower frequency).
3.  Save to `LocationEvent` with `source='google'`.
4.  *Note: Handling Google credentials securely is critical here.*

**Verification**:
*   Mock Google API response.
*   Verify DB persistence.

### 3.3 Data Freshness & Cleanup
**Objective**: Ensure stale data doesn't persist forever and database doesn't grow infinitely.
**Actions**:
1.  **Resolution Logic Update**: Ensure `resolveStatus` checks the timestamp of the latest `LocationEvent`. If it's older than X hours, return `null` or a "stale" flag.
2.  **Cleanup Job**: (Optional for V1, but good practice) Implement a daily job to delete `LocationEvent` rows older than 90 days.

**Verification**:
*   Test the freshness logic by manually inserting an old record and verifying `GET /status` ignores it or marks it.
