# 01. Requirements

**Status:** Draft

Priority: **M** = mandatory (PRD states it, never cut). **S** = should (cuttable per [PLAN](../PLAN.md#cut-order-if-time-runs-short)).

## Functional

| ID | Requirement | Acceptance criteria | Pri |
|---|---|---|---|
| FR-1 | Fixed timers | Merchant sets start and end. Timer appears automatically at start and ends at end, the same for all visitors. A page opened more than 5 minutes before start needs a reload to show it | M |
| FR-2 | Evergreen timers | Countdown starts at a visitor's first view, persists across reloads, restarts after expiry or 30 min idle | M |
| FR-4 | Targeting | Scope is all products, specific products, or specific collections. Timer shows only on matching product pages | M |
| FR-5 | Resource Picker | Products and collections are chosen with Shopify's picker, and previous selections are preloaded on edit | M |
| FR-6 | Customization | Background colour, text colour, size, position, headline and description are all reflected on the storefront. The `small` size omits the description | M |
| FR-7 | Urgency cues | With `color_pulse`, the timer pulses once remaining time falls below the threshold. Reduced-motion users get a static colour | M |
| FR-8 | Dashboard | Lists all timers with status, type, targeting summary, schedule and impressions, with an empty state | M |
| FR-8a | Dashboard search, status filter, sort | List narrows and reorders accordingly | S |
| FR-8b | Overlap warning | Dashboard flags timers competing for the same target | S |
| FR-9 | Create and edit form | Opens in a modal. Invalid input shows a field-level error, both client and server validate, and dates are in the shop's timezone | M |
| FR-10 | Analytics display | Impression count appears per timer | M |
| FR-11 | Impression tracking | One count when a timer is at least 50% visible, once per page view. Tracking failure is invisible to visitors | M |
| FR-12 | Storefront display | Merchant adds the app block on product templates; the matching timer shows live | M |
| FR-13 | Config fetch | Widget gets candidates from one API call, without interval polling | M |
| FR-14 | Selection | When several match: product > collection > all, then soonest end, then latest update. Exactly one shows | M |
| FR-15 | Edge cases | Expired mid-view: "Offer ended" inside the same box. None active: Liquid outputs nothing, though an out-of-date hint can leave a blank reserved box. Network failure: a blank reserved box, or nothing for bars, with no console errors. The box never collapses | M |
| FR-16 | Timer CRUD API | Create, read, update, delete and list per [04-api](04-api.md) | M |
| FR-18 | Onboarding link | Admin links to the theme editor to add the block | S |

## Non-functional

| ID | Requirement | Acceptance criteria | Pri |
|---|---|---|---|
| NFR-1 | Theme App Extension | Uses an app block. No ScriptTag anywhere | M |
| NFR-2 | Single config call | One `GET /proxy/timers` per page view for config, apart from its failure retry and the refetch rules in [05-widget](05-widget.md#data-flow-and-refresh). No call on non-matching products while the hint is available | M |
| NFR-3 | Caching headers | `Cache-Control` per [04-api](04-api.md#caching). Errors are not cached | M |
| NFR-4 | Bundle size | Gzipped JS plus CSS: target ≤15KB, build fails above 30KB | M |
| NFR-5 | API speed | `GET /proxy/timers` under 200ms server-side p95 | M |
| NFR-6 | No layout shift | CLS 0 from the widget on matching and non-matching products | M |
| NFR-7 | Graceful degradation | API down or script error leaves the storefront working, with no uncaught errors | M |
| NFR-8 | Shop verification | Every call has a verified shop: session token or proxy HMAC | M |
| NFR-9 | Input safety | All input validated by schema, and HTML stripped. Merchant text can't execute on the storefront | M |
| NFR-10 | No sensitive exposure | No secrets in client code. Public responses use an allowlist | M |
| NFR-11 | Tenant isolation | A shop cannot read, change or count against another shop's data | M |
| NFR-12 | Rate limiting | Limits per [04-api](04-api.md#rate-limiting), and the approach is documented in the README | M |
| NFR-13 | Error contract | Consistent error shape and correct status codes | M |
| NFR-14 | JavaScript | Backend is JavaScript | M |
| NFR-15 | Tests | At least 5 meaningful unit tests on business logic. This plan targets many more | M |
| NFR-16 | Lint | ESLint config passes with no errors | M |
| NFR-17 | Stack | MongoDB, Express, React, Node; Shopify CLI; node-express template; Polaris web components | M |
| NFR-18 | Smooth countdown | No drift or width jitter across a long view | M |

## Deliverables

| ID | Deliverable | Pri |
|---|---|---|
| DEL-1 | GitHub repo with clean, progressive commit history | M |
| DEL-2 | README: setup, architecture decisions, assumptions | M |
| DEL-3 | Brief API endpoint documentation | M |
| DEL-4 | 10-15 min Loom: walkthrough, architecture, trade-offs, improvements | M |
| DEL-5 | Performance optimizations documented | M |

## Out of scope

- Creating or applying Shopify discounts. Timers are display only.
- Timers on pages other than product pages (home, collection, cart).
- Production hosting. Demo runs through the Shopify CLI tunnel.
- Time-series analytics, clicks or conversion tracking. Impressions are a running total.
- Variant-level targeting, billing, A/B testing, translated storefront text.
- Multi-instance scaling, such as a shared rate-limit store. Documented as a future improvement.
- Correcting visitors' wrong device clocks (gap G10).
- Pausing timers. The PRD has three statuses, so stopping a timer means deleting it (gap G2).
- Uninstall and privacy compliance webhooks. The PRD doesn't ask for them, and the template's stubs stay as shipped. Listing on the App Store would require them.
