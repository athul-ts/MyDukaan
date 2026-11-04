---
description: Check the specs against the PRD for gaps, contradictions and unverified claims
argument-hint: "[spec file, or blank for all]"
---

Review the specifications for: $ARGUMENTS (if blank, review everything in `specs/`).

Read `specs/PRD.md`, `specs/00-derivation.md`, `specs/01-requirements.md`, and the specs under review. Then check:

1. **Coverage:** does every PRD statement in scope have a requirement, and does every requirement have behaviour specified?
2. **Contradictions:** do any two specs disagree? Compare field names, enums, limits, status codes and cache values between `02-domain-rules.md`, `03-data-model.md`, `04-api.md`, `05-widget.md`, `06-admin.md` and `openapi.yaml`.
3. **Undefined behaviour:** look for edge cases with no stated outcome, such as boundary times, empty lists, missing data and failure paths.
4. **Testability:** can each acceptance criterion be checked? Does `09-test-plan.md` cover it?
5. **Unverified claims:** is any platform behaviour stated as fact without a source in `00-derivation.md` or a spike in `10-spikes.md`?
6. **Decision integrity:** do the specs still honour every outcome marked **Decided** in `00-derivation.md`?

Do not edit files. Report findings ordered by severity. For each, give the file and section, the problem, and a suggested fix. If a category has no findings, say so. End with one line: ready or not ready for Gate 1.
