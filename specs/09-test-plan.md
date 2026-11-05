# 09. Test Plan

**Status:** Approved (Gate 1, 2026-11-05) | **Implements:** NFR-15, 16; DEL-2, 3, 5

## Automated

Run with `npm test`. Unit tests inject `now`. Integration tests use the `countdown_timer_test` local database and mock calls to Shopify.

| ID | Target | Must prove | Covers |
|---|---|---|---|
| T-1 | `deriveStatus` | Evergreen is active; start inclusive, end exclusive at the exact millisecond | FR-1, 8 |
| T-2 | `rankCandidates`, `selectTimer` | Each tie-break level; evergreen sorts after fixed of equal specificity; a future candidate goes live from a cached list; an evergreen timer that ended this page view hands over to the next candidate | FR-14, FR-1 |
| T-3 | Evergreen state | First visit; continue; expiry; idle beyond 30 min; just under 30 min; duration change restarts; other edits don't; corrupt JSON; clock moved back; blocked storage falls back to memory | FR-2 |
| T-4 | Validation schema | Bad date order; fixed/evergreen field mix; bad colours and GIDs; empty targeting; unknown keys; HTML stripped; operator objects like `{$gt: ""}` rejected | FR-9, NFR-9 |
| T-5 | Proxy HMAC | Valid; tampered parameter; wrong secret; missing signature; repeated parameter joined by comma | NFR-8 |
| T-6 | Tenant isolation (integration) | Shop B gets 404 on read, update, delete of shop A's timer; list excludes it; impressions can't be posted across shops | NFR-11 |
| T-7 | Public serializer (integration) | Exact allowlisted keys. `name`, `shop`, targeting and impressions absent | NFR-10 |
| T-8 | `buildHint` | Excludes expired; order matches selection; delimiters prevent partial ID matches; contains no merchant text; over 120KB writes the overflow marker | NFR-6, FR-4 |
| T-9 | API (integration) | Status codes and error shape for 400, 401, 404, 422, 429; unauthenticated rejection; `q` regex escaping; cache headers on success and errors; ETag 304 | FR-16, NFR-3, 12, 13 |
| T-10 | Target query (integration) | All, product and collection scopes, with `sanitizeFilter` on; expired excluded; up to 3 returned, ranked; a live timer is always included | FR-4, 13 |
| T-11 | `isUrgent`, countdown formatter | Threshold boundary; `none` mode; days omitted when zero | FR-7, NFR-18 |
| T-12 | Hint sync failure and recovery | Timer still saves and `hintSync` is `failed`; the list still reports it on a later read; `POST /api/hint/sync` clears it; the rebuilt hint reflects the current timers | FR-16 |
| T-13 | `shouldRefetch` | Tab return under and over 5 minutes; all ended waits 150 seconds; only one refetch per list, so no loop | FR-13 |
| T-14 | Impressions (integration) | First count creates the stats document and later ones increment it; returns 202; accepts `text/plain` and JSON; unknown or malformed ID returns 404; malformed JSON returns 400 | FR-11 |

## Other automated checks

| ID | Command | Passes when | Covers |
|---|---|---|---|
| A-1 | `npm run lint` | No errors, and `dangerouslySetInnerHTML` is forbidden | NFR-16 |
| A-2 | `npm run check:size` | Under 30KB gzipped, with size reported against the 15KB target | NFR-4 |
| A-3 | `npm run perf:proxy` | `GET /proxy/timers` p95 under 200ms with 200 timers | NFR-5 |
| A-4 | `npm test` | All pass, with at least 5 meaningful unit tests on business logic | NFR-15 |

## Manual on the dev store

Recorded with pass or fail before submission.

| ID | Steps | Expected | Covers |
|---|---|---|---|
| M-1 | Create a fixed timer starting 2 minutes ahead, targeting one product | Status goes scheduled → active → expired. Appears on storefront at start without a code change | FR-1, 8 |
| M-2 | Create an evergreen timer; reload; reopen the tab | Time continues | FR-2 |
| M-3 | Set `lastSeenAt` in storage to 31 min ago; reload | Restarts | FR-2 |
| M-4 | Target all, then product, then collection, using the real picker from the modal; check a non-target product | Shows only where targeted. Edit preloads selections | FR-4, 5 |
| M-5 | Change colours, size, position, text | Reflected on the storefront within the cache window | FR-6 |
| M-6 | Timer with pulse near threshold | Pulses; static with OS reduced-motion on | FR-7 |
| M-7 | Two timers on one product | The more specific timer shows | FR-14 |
| M-8 | Let a timer expire mid-view | "Offer ended"; no layout movement | FR-15, NFR-6 |
| M-9 | Save `<img src=x onerror=alert(1)>` as a description | Stripped; nothing executes | NFR-9 |
| M-10 | Block the proxy in DevTools; force a slow network | Page works, no console errors, no shift | FR-15, NFR-7 |
| M-11 | Inspect network on a matching page, and leave it open for 5 minutes | One config call, expected `Cache-Control`, reload served from browser cache, no repeated requests | NFR-2, 3, FR-13 |
| M-12 | Inspect network on a non-matching page | No script and no API call | NFR-2, 6 |
| M-13 | Scroll the timer into view; repeat; check the dashboard | One impression per page view, only once visible | FR-10, 11 |
| M-14 | Lighthouse on matching and non-matching pages, mobile | Widget-attributed CLS 0 | NFR-6 |
| M-15 | Set store timezone differently from the browser; enter a time | Storefront starts at the shop's wall-clock time | FR-9 |
| M-16 | Delete a timer | Stops displaying within the cache window, and its stats are gone | FR-16 |
| M-17 | Uninstall and reinstall the app; open it and view a targeted product | Admin loads, timers are intact, and the hint is rebuilt | FR-16 |
| M-18 | Add the app block to the product template in the theme editor; view a product | Block appears under Apps, and the timer shows where placed | FR-12 |
| M-19 | Use dashboard search, status filter and sort; create two competing timers | List responds correctly, and the overlap warning appears (skip if cut) | FR-8a, FR-8b |
| M-20 | Follow the admin's theme editor link | Opens the editor ready to add the block (skip if cut) | FR-18 |
| M-21 | Inspect the repo: search for `ScriptTag` and `@shopify/polaris`; check the backend's language and the stack against the spec | None found, backend is JavaScript, and the stack matches | NFR-1, NFR-14, NFR-17 |
| M-22 | Use a DevTools override to return invalid JSON, then a valid response with the wrong shape | Page works, with no uncaught errors | NFR-7, FR-15 |
| M-23 | In the modal, submit invalid input; then let a valid end time pass before saving, so only the server rejects it | Field errors appear inline for both, and form contents are kept | FR-9 |
| M-24 | Search the repo, built admin assets and widget bundle for the API secret and access tokens | None found | NFR-10 |
| M-25 | Watch a timer for 5 minutes beside a reference clock, on desktop and phone width | No drift, and the box width and digits don't jitter | NFR-18 |
| M-26 | Check the Liquid decision for: lead-in, live, expired, evergreen; all, product, collection; product ID 123 against a target of 1234; hint missing; hint overflow | Each reserves space, loads the script or outputs nothing, per [05-widget](05-widget.md#zero-cls-flow) | FR-4, NFR-6 |

## Traceability check

Before submission, every `FR`, `NFR` and `DEL` row in [01-requirements](01-requirements.md) must show one of: passing test, recorded manual check, or a deliberate cut listed in the README. Run `/spec-trace` to report any that don't.

## Deliverable checks

| ID | Check | Covers |
|---|---|---|
| D-1 | `git log` shows slice-by-slice progression | DEL-1 |
| D-2 | A fresh clone follows the README to a running app. README has architecture decisions, assumptions and the rate-limit approach | DEL-2, NFR-12 |
| D-3 | README API section matches `openapi.yaml` | DEL-3 |
| D-4 | Loom is 10-15 min and covers functionality, architecture, trade-offs, improvements | DEL-4 |
| D-5 | README records optimizations and measured numbers | DEL-5 |
