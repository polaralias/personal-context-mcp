# Contract Hardening

## Outcome

Turn validated findings into explicit behaviour contracts and then enforce them in code and tests.

## Scope

- resolver specification
- auth surface clarification
- runtime and storage contract clarification
- tool input and output normalisation

## Contract decisions now fixed in docs

- scheduled location remains part of the desired product contract and must become real resolver behaviour unless the product spec is explicitly changed first
- `status_set_work` is the canonical end-state work-status write surface
- `status_set_override` is legacy surface and should not survive into the repaired end-state contract

## Current status

Completed in the repaired repository state:

- scheduled location is real resolver behaviour
- `status_set_work` is the canonical public work-status write surface
- `status_set_override` is removed from the exported tool inventory
- storage default is explicit as `./data/mcp.db` for direct local runs
- resolver, tool, runtime, and auth contracts have executable tests
- public location writes are locked to manual provenance
- public scheduled-context writes are locked to manual provenance
- scheduled-location input is normalised and validated at the public write boundary
- mocked integration coverage now includes malformed Google geocode payload handling and invalid Home Assistant coordinate handling
- reusable HTTP response and error helpers support the integration harness

## Exit criteria

- specs exist
- docs match implemented tested behaviour
- the active test plan points to remaining gaps rather than missing first principles
