# Resolver Principles

## Goal

The resolver should produce one coherent effective context for a target date and time.

## Desired properties

- temporal correctness
- explicit precedence
- explainable fallback behaviour
- stable treatment of expiry and staleness

## Current validated contract

- work-status history is temporally safe
- scheduled location is part of effective resolution
- expiry and staleness boundaries are explicit and test-backed
- resolver outputs include explicit winning-source provenance

## Current expectation

For any query date, the service should be able to explain:

- which work-status source won
- which location source won
- which scheduled-context entry was applied
- whether holiday or weekend logic was involved
