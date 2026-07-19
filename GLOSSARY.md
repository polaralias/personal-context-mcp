# Glossary

This glossary resolves agent-facing personal context from status, location, schedule, and holiday inputs.

It exists to provide one coherent answer about effective personal state rather than exposing raw records as the product.

## Language

**Effective Context**:
The resolved personal state returned to clients for a target date and time.
_Avoid_: Current truth, derived state, final answer

**Provenance**:
Structured information describing which input source produced part of an **Effective Context**.
_Avoid_: Debug note, trace text, free-form explanation

**Work-Status Event**:
A dated status record that may affect effective work state until superseded or expired.
_Avoid_: Override, status override, work override

**Location Event**:
A recorded location input that may affect effective location until expired or stale.
_Avoid_: Location override, live location record

**Location Source**:
The controlled origin category for a **Location Event**.
_Avoid_: Free-form source label, arbitrary source string

**Scheduled Context**:
A planned per-date context entry that may adjust effective work status and planned location.
_Avoid_: Schedule patch, schedule override, date override

**Scheduled Context Source**:
The controlled origin category for a **Scheduled Context** entry.
_Avoid_: Computed, derived, free-form source label

**Reason**:
An explanatory annotation attached to a context input that does not change effective resolution.
_Avoid_: Rule, signal, precedence input

**Bank Holiday**:
A public holiday signal that contributes to baseline work-status resolution.
_Avoid_: Holiday cache row, holiday event

## Relationships

- An **Effective Context** is resolved from zero or more **Work-Status Events**
- An **Effective Context** may include one applicable **Location Event**
- An **Effective Context** may include **Provenance** for work status and location
- A **Location Event** has exactly one **Location Source**
- A **Scheduled Context** may adjust an **Effective Context** for exactly one date
- A **Scheduled Context** may define planned **Work-Status Event** semantics and planned location together
- A **Scheduled Context** has exactly one **Scheduled Context Source**
- Manual creation of a **Location Event** is a first-class product capability
- Public location writes create manual **Location Events** only; non-manual location provenance is system-owned
- Public scheduled-context writes create manual **Scheduled Context** only; `automated` provenance is system-owned
- Public write intent for current work state is expressed as setting current work status, not exposing raw event mechanics as the product contract
- On the current date, an applicable **Work-Status Event** outranks planned work status from **Scheduled Context**
- On the current date, an applicable **Location Event** outranks planned location from **Scheduled Context**
- A **Scheduled Context** must contain planned work status, planned location, or both
- **Scheduled Context** is directly queryable and manageable, not only resolver input
- A stale **Location Event** does not contribute to **Effective Context**
- A **Scheduled Context** may override the baseline effect of a **Bank Holiday**
- A **Reason** may be returned to clients but does not change **Effective Context**
- The winning **Reason**, when present, may be surfaced alongside **Effective Context**
- **Provenance** may be surfaced alongside **Effective Context** to explain winning sources
- calendar facts such as weekend and bank holiday remain visible even when they do not determine the final **Effective Context**
- For non-current dates without **Scheduled Context**, **Effective Context** still resolves baseline work status while leaving location `null`
- Historical raw **Location Event** data is not elevated into **Effective Context** unless a matching **Scheduled Context** defines planned location
- **Effective Context** always resolves to a minimal structured answer rather than being empty
- baseline provenance stays coarse, while weekend and bank-holiday detail remain separate factual fields
- A **Bank Holiday** may affect baseline work-status resolution for an **Effective Context**

## Example dialogue

> **Dev:** "If a **Work-Status Event** is written today, can it change last week's **Effective Context**?"
> **Domain expert:** "No. A **Work-Status Event** only applies when it is valid for the target date being resolved."

## Flagged ambiguities

- "override" was used to mean a **Work-Status Event** — resolved: `override` is not a canonical domain term
- `status_set_override` reflects non-canonical legacy language — resolved: remove it from the end-state product surface rather than preserving it
- "schedule patch" was used to mean **Scheduled Context** — resolved: `patch` is implementation language, not domain language
- scheduled location support was ambiguous — resolved: **Scheduled Context** includes planned location as a real domain concept
- future or non-current dates without **Scheduled Context** were ambiguous — resolved: effective location is `null` in that case
- current-date work-status precedence was ambiguous — resolved: live **Work-Status Event** wins over scheduled work status
- current-date location precedence was ambiguous — resolved: live **Location Event** wins over scheduled location
- empty or reason-only scheduled entries were ambiguous — resolved: **Scheduled Context** must contain `workStatus`, `location`, or both
- planned vs actual work status naming was considered — resolved: do not add extra canonical terms; planned status lives inside **Scheduled Context**, actual status comes from **Work-Status Event**
- stale location handling was ambiguous — resolved: stale **Location Event** is excluded from effective location, not returned with advisory status
- bank-holiday override behaviour was ambiguous — resolved: **Scheduled Context** may override a bank-holiday baseline
- `reason` semantics were ambiguous — resolved: **Reason** is annotation only, visible to clients but never used in resolution
- read visibility for `reason` was ambiguous — resolved: the winning **Reason** may be surfaced with **Effective Context**
- location source vocabulary was ambiguous — resolved: **Location Source** is controlled, not free-form
- allowed **Location Source** values were ambiguous — resolved: initial allowed values are `manual` and `homeassistant`
- manual location writes were considered as possible admin-only behaviour — resolved: manual **Location Event** creation remains first-class product capability
- scheduled provenance vocabulary was ambiguous — resolved: **Scheduled Context Source** is controlled, with initial values `manual` and `automated`
- `computed` was considered as a scheduled source term — resolved: `computed` is not provenance language and should be reserved for resolved output semantics
- explainability shape was ambiguous — resolved: **Effective Context** should include structured **Provenance** for winning sources
- scheduled visibility was ambiguous — resolved: **Scheduled Context** remains a first-class queryable and manageable surface
- provenance vocabulary was ambiguous — resolved: use controlled provenance values rather than free-form explanation categories
- calendar fact visibility was ambiguous — resolved: weekend and bank holiday remain visible as separate facts even when a higher-precedence source wins
- non-current date fallback behaviour was ambiguous — resolved: baseline work status still resolves even when no **Scheduled Context** exists
- historical location semantics were ambiguous — resolved: historical **Location Event** data stays in history surfaces and does not populate non-current **Effective Context** unless scheduled
- empty-response semantics were ambiguous — resolved: **Effective Context** is a total function and always returns a minimal structured answer
- public write semantics for work status were ambiguous — resolved: the end-state write contract is intent-shaped even though **Work-Status Event** remains a domain concept
- baseline provenance granularity was ambiguous — resolved: keep `baseline` coarse and rely on separate weekend/bank-holiday facts for detail
