---
description: Report whether Gate 1 or Gate 2 criteria are met
argument-hint: "[1 or 2, or blank for the current gate]"
---

Check Gate $ARGUMENTS. If blank, work out the current gate from the status table in `PLAN.md`.

Read the gate criteria in `PLAN.md`, then verify each against the evidence:

- **Gate 1:** Gate 1 decisions in `specs/README.md` are answered; every spec shows `Status: Approved`, except `10-spikes`, which stays Open until Gate 2; no PRD line lacks a requirement.
- **Gate 2:** prerequisites are ticked; verify what can be checked locally, such as `node -v` being 24.x, the `shopify` command, and MongoDB answering on port 27017; each spike in `specs/10-spikes.md` has a result; `specs/08-dependencies.md` holds exact versions; specs are marked v1.0.

Output a table with columns Criterion, Evidence and Pass or Fail. Don't change any files.

**Only the user clears a gate.** Report what is met and what isn't. Don't mark a gate cleared, and don't begin development, unless the user says so.
