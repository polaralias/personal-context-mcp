# Security

## Security principle

This service should use a simple, explicit auth model that is easy to reason about and hard to misunderstand.

## Current verified auth model

Validated behaviour:

- `/health` is unauthenticated
- `/mcp` requires bearer-token auth whenever auth is not explicitly disabled
- accepted keys come from:
  - `PERSONAL_CONTEXT_MCP_API_KEY`
  - `MCP_API_KEY`
  - `MCP_API_KEYS`
- `API_KEY_MODE=disabled` disables auth checks and is surfaced as `disabled` in health output
- when auth is not disabled and no keys are configured, health reports `unconfigured` and `/mcp` remains protected
- health output reports precise auth posture and no longer echoes inactive security-adjacent knobs

## Current contract edges

- request rate limiting is not part of the current public contract
- bearer-token auth remains intentionally simple and does not attempt broader identity or authorisation features

## Current security contract

The auth surface should be:

- one clear model
- one clear set of active controls
- one clear statement of what is public and what is protected

Specifically:

- `/health` may remain public if that is intentional and documented
- `/mcp` should remain protected by explicit bearer-token auth unless intentionally disabled
- disabled auth should be visibly unsafe and clearly marked for local-only use
- rate limiting and token-issuance claims are outside the current public contract unless they are implemented and tested later

## Security documentation rule

Never describe a control as present unless it is:

- implemented
- tested
- documented as active behaviour
