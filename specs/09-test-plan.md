# 09. Test Plan

**Status:** v1.0 (Gate 2, 2026-11-05) | **Implements:** NFR-15, 16; DEL-2, 3, 5

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
| T-15 | Stale session (integration) | A 401 from the Admin API deletes the session and returns 401 with the retry header; the next request creates a new session; `afterAuth` rebuilds the hint | FR-16 |
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
| M-27 | Set a timer to Top bar, then Bottom bar, and view a targeted product on the dev store | The whole countdown is visible, with the header and page content painted beneath it, and no layout movement | FR-6, NFR-6 |

## Results

Recorded 2026-11-06. "Store" is the dev store `mydukaan-bc2ubatx` on the Horizon theme, checked by the user. "Local" is the scratchpad harness: the real block Liquid, CSS and widget bundle in headless Chrome, with the API stubbed. A local pass doesn't replace a store check, so those rows stay **Partial** or **Not run**.

### Automated

| ID | Result | Evidence |
|---|---|---|
| T-1 to T-15 | Pass | `npm test`: 184 tests in 9 files |
| A-1 | Pass | `npm run lint`: no errors |
| A-2 | Pass | 9.56KB JS + CSS gzipped (JS 8.92KB) |
| A-3 | Pass | p95 11.6ms server-side, 2000 requests, 10 concurrent, 200 timers |
| A-4 | Pass | 184 tests: 125 unit tests in `tests/unit` and 59 integration tests |

### Manual

| ID | Result | Evidence |
|---|---|---|
| M-1 | Partial | Store: `Test Fixed` went scheduled → active on its own and appeared. Its expiry wasn't watched. Local: start and "Offer ended" pass |
| M-2 | Pass | Store: reload continued the countdown |
| M-3 | Pass | Store: after setting `lastSeenAt` to 31 minutes ago, a reload restarted the evergreen countdown from 00:32:09 to 00:44:55. Also covered by T-3 |
| M-4 | Partial | Store: product and collection (`Timer Test`) targeting, with non-target products clean. All-products scope and edit preloading weren't checked separately |
| M-5 | Pass | Store: colour, position (top bar, bottom bar, inline) and size changes reached the storefront |
| M-6 | Not run | Local: pulse runs, and reduced motion swaps colours |
| M-7 | Partial | Store: fixed beat evergreen on a product both target. Product beating collection or all is covered by T-2 and local only |
| M-8 | Pass | Store: "Offer ended" in the same box with no visible movement |
| M-9 | Pass | Store: saving `<img src=x onerror=alert(1)>` as a description produced no popup in the admin or on the storefront. Stripping is covered by T-4 |
| M-10 | Pass | Store: with the `timers` request blocked in DevTools, the page worked. Local: blocked, 500 and slow responses leave the box empty, its height kept, CLS 0, no uncaught errors, no request loop |
| M-11 | Partial | S3 confirmed `Cache-Control` and browser-cache reuse through the proxy. The 5-minute watch wasn't done |
| M-12 | Pass | Store: no script and no API call on a non-target product; `cdt-` not found in the page |
| M-13 | Pass | Store: impressions rose (Evergreen 8 → 15, Test Fixed 0 → 2). Once per page view and only when visible: local |
| M-14 | Pass | Store, mobile: CLS 0 on Clay Plant Pot and Copper Light (first Clay Plant Pot run 0.003, not repeated). White Ceramic Pot, no timer: 0.008 from the theme, as the widget doesn't load there |
| M-15 | Partial | Store timezone New York, browser India. `Test Fixed`, set for 9:00 AM New York, became active and counted down to its end, but the exact start moment wasn't watched |
| M-16 | Pass | Store: a deleted timer stopped showing on its product after a reload. Stats removal is covered by the delete integration test |
| M-17 | Pass | Store: after uninstalling, `npm run dev` reinstalled the app; timers were intact and the timer showed again. Uninstalling removed the block from the theme, so it had to be added again, which is Shopify's behaviour for app blocks |
| M-18 | Pass | Store: block added under Apps and shows where placed |
| M-19 | Pass | Store: search, status filter (after the "Invalid query" fix) and sort; "Competes with 1 other timer" shown |
| M-20 | Pass | Store: the link opened the theme editor to add the block |
| M-21 | Pass | `git grep`: no `ScriptTag` or `@shopify/polaris`; backend is JavaScript; stack matches 08-dependencies |
| M-22 | Not run | Local: invalid JSON and wrong-shape responses leave the page working |
| M-23 | Pass | Store: field errors shown, as reported by the user. Tests: the client rule ("Must be after start", "Must be in the future"), the server's 422, and a server error mapped back onto the form field (`timer-form.test.js`) |
| M-24 | Pass | No token prefixes (`shpss_`, `shpat_`, `shpca_`, `shppa_`), secret variable names or MongoDB URLs in tracked files, the widget bundle or a fresh admin build. `.env` isn't tracked. The secret's value itself wasn't searched for, as it isn't read |
| M-25 | Not run | Local: digits and box width steady |
| M-26 | Pass | Local Liquid harness: 23 cases |
| M-27 | Pass | Store: both bars above the header and page content, live and in the theme editor |

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
