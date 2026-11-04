---
description: Report PRD lines or requirements with no spec, test or code behind them
---

Build a traceability report.

1. Read `specs/PRD.md` and the table in `specs/00-derivation.md`. List any PRD statement that has no requirement.
2. Read `specs/01-requirements.md` and `specs/09-test-plan.md`. List any `FR-x`, `NFR-x` or `DEL-x` with no check.
3. If application code exists, search `web/`, `shared/`, `widget/` and `extensions/` for an implementation of each requirement, and search the test files for each `T-x`. List requirements with no implementation and planned tests that don't exist.
4. Separate the deliberate cuts listed in `PLAN.md` or the README from real gaps.

Do not edit files. Only state a requirement as implemented if you have seen the code. Output a table with columns Requirement, Spec, Check, Implemented and Gap, followed by a count of open gaps.
