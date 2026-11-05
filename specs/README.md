# Specifications

**Version:** 1.0 (Gate 2 cleared 2026-11-05) | **Date:** 2026-11-05 | **Source:** [PRD](PRD.md)

## Index

| Spec | Covers | Status |
|---|---|---|
| [PRD](PRD.md) | The assessment's original requirements. Wording is unchanged; its three images were removed, and two are now described in specs 05 and 06 | Source |
| [00-derivation](00-derivation.md) | PRD line → requirement → spec, plus conflicts, gaps and who decided each | v1.0 |
| [01-requirements](01-requirements.md) | FR, NFR and DEL requirements with acceptance criteria; out of scope | v1.0 |
| [02-domain-rules](02-domain-rules.md) | Status, selection, evergreen state, validation | v1.0 |
| [03-data-model](03-data-model.md) | Collections, indexes, tenant isolation | v1.0 |
| [04-api](04-api.md) and [openapi.yaml](openapi.yaml) | Endpoints, auth, errors, caching, rate limits | v1.0 |
| [05-widget](05-widget.md) | Zero-CLS flow, metafield hint, refresh, failure handling | v1.0 |
| [06-admin](06-admin.md) | Dashboard, form, Polaris components, timezone | v1.0 |
| [07-nfr-security](07-nfr-security.md) | Budgets and security rules, and how each is measured | v1.0 |
| [08-dependencies](08-dependencies.md) | Versions, constraints, prerequisites | v1.0 |
| [09-test-plan](09-test-plan.md) | Automated and manual checks mapped to requirements | v1.0 |
| [10-spikes](10-spikes.md) | S1-S4: results and fallbacks | Closed |

## Reading order

For a review, read `00-derivation` first: it shows where the PRD was contradictory or silent, and what was chosen. Then read `01-requirements`. The other specs hold the detail behind them.

## Gate 1 decisions

Answered by the user on 2026-11-05.

| # | Decision | Answer | Where |
|---|---|---|---|
| 1 | Commit attribution | User's name only, no `Co-Authored-By` line | [CLAUDE.md](../CLAUDE.md#git) |
| 2 | Create/edit form: page or modal | Modal, as in the mockup | [06-admin](06-admin.md#form) |
| 3 | Proposed PRD resolutions | Deferred: the user is reminded as each is reached. They stand as working assumptions until then | [PLAN](../PLAN.md#deferred-resolutions) |
| 4 | Fourth status, `paused` | Dropped, following the PRD: three statuses only | [02-domain-rules](02-domain-rules.md#status) |
| 5 | Demo through the CLI tunnel, no production deploy | Yes | [01-requirements](01-requirements.md#out-of-scope) |
| 6 | Compliance webhooks | Not in the PRD, so not built | [04-api](04-api.md#webhooks) |

## Changing a spec

- **Before v1.0:** edit directly. Record decisions in `00-derivation`.
- **After v1.0:** spec change comes first, with a changelog line at the bottom of that file, then code.
- A spec moves `Draft` → `Approved` only when the user approves it.
- Items marked **[S1]** to **[S4]** depend on an unverified platform behaviour. Their spike result can amend them before v1.0.
