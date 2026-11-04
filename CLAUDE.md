# Countdown Timer + Analytics (Shopify app)

Assessment project with a hard deadline. Source requirements: [specs/PRD.md](specs/PRD.md). Delivery plan and live status: [PLAN.md](PLAN.md). Specifications: [specs/README.md](specs/README.md).

## Workflow: specs first

1. **Do not write app code, scaffold, or install packages until Gate 2 is cleared.** Check the status table in `PLAN.md`. Only the user clears a gate.
2. The specs are the source of truth. If code and spec disagree, stop and resolve it. After v1.0, change the spec first and the code second, in the same slice.
3. If a PRD line or spec is ambiguous, do not invent behaviour. Record it in `specs/00-derivation.md` and ask the user when it changes the outcome.
4. Every behaviour maps to a requirement ID (`FR-x`, `NFR-x`, `DEL-x`) in `specs/01-requirements.md`, and every requirement maps to a check in `specs/09-test-plan.md`.
5. Build in the slice order in `PLAN.md`. Each slice ends with its "done when" check passing.
6. Before starting any step, remind the user of its items in [Deferred resolutions](PLAN.md#deferred-resolutions) and wait for an answer.
7. Report results as they are. If a check was skipped or failed, say so.

Project commands: `/spec-review`, `/spec-trace`, `/gate-check`.

## Stack

| Layer | Choice |
|---|---|
| Backend | Node 24 LTS, JavaScript (ESM), Express, Mongoose, zod, from Shopify's node-express template |
| Database | Local MongoDB Community 8.3 at `mongodb://127.0.0.1:27017`. No Docker |
| Admin | React + Vite from the template, **Polaris web components** via CDN, App Bridge. Never add `@shopify/polaris`: it is deprecated |
| Storefront | Theme App Extension app block + Preact widget. Never use ScriptTag |
| Tests and lint | vitest, supertest, ESLint |

Versions and their constraints: [specs/08-dependencies.md](specs/08-dependencies.md). Do not add a dependency that is not listed there without updating that file first.

## Planned layout (after scaffold)

```
web/                     Express: routes/, middleware/, repositories/, services/
web/frontend/            Admin app
shared/                  Pure rules: status, selection, evergreen, validation, hint
widget/                  Preact source; builds into the extension's assets
extensions/countdown-timer/   App block Liquid and built assets
specs/                   Specifications
```

## Rules that must never be broken

- **Tenant isolation:** `shop` comes only from the verified session or verified proxy signature, never from a body or query parameter. All data access goes through repositories that require `shop`. Another shop's resource returns 404.
- **Storefront safety:** the widget must never break a page. It runs in an IIFE with try/catch and an error boundary, and fails silently.
- **Zero CLS:** do not collapse or resize a rendered inline box. Expired timers show "Offer ended" inside the same box.
- **Merchant text:** render as Preact text nodes only. No `dangerouslySetInnerHTML`. Liquid never outputs merchant text.
- **Public API:** responses are built from an explicit allowlist. Merchant name, targeting lists and impression counts are never public.
- **Timer status:** derived at read time, never stored.
- **Shared logic:** business rules live as pure functions in `shared/` with tests. Widget code may import only what keeps it within budget, never zod.
- **Secrets:** never commit `.env`, tokens or API secrets. Client code holds no secrets.

## Budgets

Widget bundle: target ≤15KB gzipped, build fails above 30KB. Timer fetch: under 200ms server-side p95. CLS: 0.

## Git

Commit or push only when the user asks. Keep commits small and grouped by slice, because the assessment reviews commit history.

Commits carry the user's name only. Never add a `Co-Authored-By` line or any other attribution to Claude.
