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
