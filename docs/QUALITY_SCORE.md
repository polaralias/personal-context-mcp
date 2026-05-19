# Quality Score

## Current assessment

Current repository quality: `8/10`

## Why it is not lower

- the service is real
- the core integrations are live-validated
- the domain is narrow
- the codebase is small enough to repair

## Why it is not higher

- the implementation remains concentrated in one large module
- provenance and normalization rules are now correct, but broader structural cleanup is still pending

## Conditions for raising the score

To reach `8/10`:

- already achieved:
- runtime/storage contract is explicit
- resolver behavior is defined and tested
- tool docs broadly match tested behavior
- historical investigation artifacts are separated into `docs/archive/`

To reach `9/10`:

- refactor into separated modules
- continue pruning inactive config residue and stale historical narratives
- provide clean public setup and usage guidance
