# AGENTS

## Purpose

This repository is being repaired in a contract-first way.

Agents working here should treat:

- docs as claims unless backed by validation
- code as implementation that may be wrong
- tests as the future source of truth once they exist

## Current operating mode

Until the resolver contract and runtime contract are tested, prefer:

- targeted repairs
- explicit specifications
- small, validated changes

Do not begin broad refactors until:

- runtime behavior is documented accurately
- resolver behavior is specified
- core tests exist

## Working rules

- Preserve the distinction between `current verified behavior` and `desired end state`.
- When updating docs, prefer outcome-focused language over code-shaped summaries.
- When changing behavior, update the relevant spec and execution plan in the same change.
- Keep investigation artifacts available until replacement specs and tests exist.

## Reading order for repair sessions

For a light prompt such as `follow AGENTS.md and use tdd`, start in this order:

1. `README.md`
2. `CONTEXT.md`
3. `docs/product-specs/resolver-spec.md`
4. `docs/tool-reference.md`
5. `docs/exec-plans/active/test-plan.md`
6. the relevant active execution plan under `docs/PLANS.md`

Use evidence docs after that when you need proof of current behavior or the exact shape of a known gap.

## TDD operating rule

When the prompt says `use tdd`:

- use the vocabulary in `CONTEXT.md`
- treat `docs/product-specs/resolver-spec.md` and `docs/exec-plans/active/test-plan.md` as the default contract source
- start with one small failing test from the highest-priority unresolved behavior
- prefer Track A resolver tests first, then Track C tool-contract tests, unless the task is explicitly about auth/runtime
- if implementation, spec, and evidence disagree, preserve the disagreement explicitly and repair the spec/plan references in the same change

## Primary docs

- `README.md`
- `CONTEXT.md`
- `ARCHITECTURE.md`
- `docs/SECURITY.md`
- `docs/RELIABILITY.md`
- `docs/PLANS.md`

## Evidence docs

- `docs/archive/investigation-report.md`
- `docs/archive/live-validation.md`
- `docs/archive/tool-contract-matrix.md`
- `docs/archive/refactor-repair-plan.md`
- `docs/archive/codebase-map.md`
