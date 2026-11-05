# Delivery Plan

Spec-driven delivery of the Countdown Timer + Analytics Shopify app, with **24 hours or less** available. Behaviour details live in [specs/](specs/README.md). This file covers sequence, gates and status.

**Nothing is built until Gate 2 clears.**

## Status

| Step | Output | Owner | Budget | Status |
|---|---|---|---|---|
| 1. Write spec pack | `specs/`, `PLAN.md`, `CLAUDE.md`, `.claude/` | Claude | 1.5h | Done |
| **Gate 1: spec review** | Comments resolved, specs set to `Approved` | **User** | 0.5h | **Cleared 2026-11-05** |
| 2. Prerequisites | Checklist below | **User** | 0.5h | In progress |
| 3. Spikes S1-S4 | [specs/10-spikes.md](specs/10-spikes.md) filled in, specs amended | Claude + user logins | 2h | In progress (S1) |
| **Gate 2: dependencies cleared** | Versions pinned, spikes closed, specs marked v1.0 | **User** | 0.25h | Not started |
| 4. Build slices A-E | Code, tests, commits per slice | Claude | 12h | Not started |
| 5. Docs and Loom | README, API docs, 10-15 min recording | Claude drafts, **user** records | 2h | Not started |

Total is about 19h, leaving a small buffer.

## Gate criteria

**Gate 1 is cleared when:**
- Each item in the [Gate 1 decisions list](specs/README.md#gate-1-decisions) has an answer (done)
- Every spec shows `Status: Approved` (done), except `10-spikes`, which stays Open until Gate 2
- No PRD line lacks a requirement (done, confirmed by `/spec-review`)

**Gate 2 is cleared when:**
- All prerequisites below are ticked
- S1-S4 each have a recorded result, and any fallback is written into the affected spec
- [specs/08-dependencies.md](specs/08-dependencies.md) has exact pinned versions
- Specs are marked v1.0

## Prerequisites (user)

- [x] Shopify Partner account
- [x] MongoDB running (8.3.1 confirmed on port 27017)
- [x] Install Node 24 LTS (24.22.2 through nvm-windows; Laragon's Node removed from the user PATH)
- [x] Install Shopify CLI (5.0.1)
- [ ] Development store created (`mydukaan-bc2ubatx.myshopify.com`); product import to be confirmed
- [ ] App registration (the CLI can create this during S1)
- [x] GitHub repo for submission
- [ ] Loom account

## Build slices (after Gate 2)

| Slice | Scope | Requirements | Done when | Status |
|---|---|---|---|---|
| A. Foundation | Scaffold, vendor the frontend submodule into the repo, ESLint, Mongo, env template | NFR-14, 16, 17 | App loads in the dev store admin | Not started |
| B. Domain + API | `shared/` rules, repositories, validators, admin routes, proxy HMAC, rate limits, hint sync | FR-1, 2, 4, 11, 14, 16; NFR-2, 3, 8-13, 15 | Unit and integration tests pass | Not started |
| C. Admin | Dashboard, form, resource picker, timezone handling, error states | FR-4-10, 18 | Full timer lifecycle works in the admin | Not started |
| D. Widget | Theme extension, Liquid hint logic, Preact bundle, size check, beacon | FR-2, 7, 11-15; NFR-1, 4, 6, 7, 18 | Timer renders on the storefront with CLS 0 | Not started |
| E. Hardening + docs | Edge-case pass, performance measurement, README, API docs, requirement matrix | NFR-5; DEL-1-5 | [Test plan](specs/09-test-plan.md) passes | Not started |

## Deferred resolutions

The user chose to decide these when each is reached. **Before starting the step, remind the user of its items and wait for an answer.** Until then, the rule in [00-derivation](specs/00-derivation.md) is the working assumption.

| Before | Item | Question |
|---|---|---|
| Slice B | F6 | One config call plus a separate impression beacon? |
| Slice B | G4 | Send ranked candidates so a timer starting during a cached response still appears? |
| Slice B | G7 | Restart evergreen timers for visitors only when the merchant changes the duration? |
| Slice B | G8 | Keep start and end in the hint, so Liquid can ignore expired timers? |
| Slice C | F8 | Form fields follow the PRD where the mockup lacks them? |
| Slice C | G3 | Store UTC, and enter dates in the shop's timezone? |
| Slice D | F5 | 15KB target, build fails over 30KB, 10KB advisory? |
| Slice D | G5 | At zero: next live timer, otherwise "Offer ended" in the same box? |
| Slice D | G6 | Impression = at least 50% visible, once per page view? |
| Slice D | G10 | Accept that a wrong device clock shows a wrong countdown? |
| Slice D | G11 | Accept a mismatch from Shopify's cached pages, for the duration S2 measures? |
| Slice D | G12 | Urgency: fade the background, and swap colours for reduced motion, with no new colour field? |
| Slice D | G13 | `small` size shows headline and countdown, with no description? |
| Slice E | G9 | State in the README that timers are display only and apply no discount? |

## Cut order if time runs short

Cut from the top. Mandatory PRD items are never cut.

1. Onboarding deep link
2. Overlap warning
3. Dashboard search and sort
4. ETag (keep `Cache-Control`)
5. Top/bottom bars (inline only)
6. Metafield hint, falling back to always-reserved height. Last resort, because it reverses a user decision.

## Change control

Before v1.0, edit specs freely and note decisions in [specs/00-derivation.md](specs/00-derivation.md). After v1.0, a behaviour change goes into the spec first, with a line in that spec's changelog, and then into code.
