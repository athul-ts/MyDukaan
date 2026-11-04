# 00. Derivation from the PRD

**Status:** Draft

How each spec derives from the PRD. Three kinds of outcome:

- **Direct:** the PRD states it.
- **Decided:** the PRD conflicted or was silent, and the user chose during planning.
- **Proposed:** the PRD conflicted or was silent, and this is a working assumption. The user decides each when it's reached, per [Deferred resolutions](../PLAN.md#deferred-resolutions).

## Traceability: PRD → requirement → spec

| PRD § | PRD statement | Requirement | Spec |
|---|---|---|---|
| 1, 2 | App for merchants to show countdown timers on product pages | FR-12 | 05 |
| 2 | Standalone Shopify app, uses admin and storefront | NFR-17 | 08 |
| 2 | MERN, Shopify CLI 3.0, latest Polaris | NFR-17 | 08, 06 |
| 3, 4.1 | Fixed timers with start and end; all users see the same countdown | FR-1 | 02 |
| 3, 4.1 | Evergreen timers, per visitor, localStorage, reset on expiry or session end | FR-2 | 02 |
| 3, 4.2 | Target all products, specific products, specific collections | FR-4 | 02, 03, 05 |
| 4.2, 4.4 | Shopify Resource Picker | FR-5 | 06 |
| 3 | Customize colours, position, text | FR-6 | 02, 05, 06 |
| 3, 4.3, 4.4 | Impression analytics, tracked and displayed | FR-10, FR-11 | 03, 04, 05, 06 |
| 3 | Visual urgency cues near expiry | FR-7 | 02, 05 |
| 4.3 | Schema handles multi-tenant isolation | NFR-11 | 03 |
| 4.3 | Schema holds timer config and targeting | FR-16 | 03 |
| 4.4 | Dashboard with active, scheduled, expired | FR-8 | 02, 06 |
| 4.4 | Create and edit form with validation | FR-9 | 02, 06 |
| 4.5 | Preact widget, ~15KB gzipped target | NFR-4 | 05, 07 |
| 4.5 | Efficient polling and caching | NFR-3, FR-13 | 04, 05 |
| 4.5 | Handle expired, none active, network failure | FR-15 | 05 |
| 4.5 | Smooth animation, no layout shift | NFR-18, NFR-6 | 05 |
| 4.5 | Widget fetches JSON and shows the timer on the product page | FR-12, FR-13 | 04, 05 |
| 4.6 | Proper error handling and status codes | NFR-13 | 04 |
| 4.6 | Input validation and sanitization | NFR-9 | 02, 07 |
| 4.6 | Rate limiting considered and documented | NFR-12 | 04 |
| 5.1 | Theme App Extension, not ScriptTag | NFR-1 | 05 |
| 5.1 | Single optimized API call for config | NFR-2 | 04, 05 |
| 5.1 | Proper caching headers | NFR-3 | 04 |
| 5.1 | Architecture decisions in README | DEL-2 | 09 |
| 5.2 | JavaScript for at least the backend | NFR-14 | 08 |
| 5.2 | At least 5 meaningful unit tests | NFR-15 | 09 |
| 5.2 | Widget never breaks the storefront | NFR-7 | 05 |
| 5.2 | ESLint with consistent style | NFR-16 | 08 |
| 5.3 | Bundle <30KB gzipped | NFR-4 | 07 |
| 5.3 | API <200ms | NFR-5 | 07 |
| 5.3 | No CLS | NFR-6 | 05, 07 |
| 5.3 | Document performance optimizations | DEL-5 | 07 |
| 5.4 | Validate shop ownership on all API calls | NFR-8 | 04, 07 |
| 5.4 | Sanitize inputs, prevent XSS | NFR-9 | 02, 07 |
| 5.4 | No sensitive data in client code | NFR-10 | 04, 07 |
| 6 | Wireframe: timer inline under Add to cart | FR-12 | 05 |
| 6 | Admin mockup: fields and list | FR-8, FR-9 | 06 |
| 7 | GitHub repo, clean commits | DEL-1 | PLAN |
| 7 | README: setup, architecture, assumptions | DEL-2 | 09 |
| 7 | API endpoint documentation | DEL-3 | 04 |
| 7 | Loom, 10-15 min | DEL-4 | PLAN |
| 8 | Timeline | | PLAN |
| 9 | Partner account, dev store, sample products, CLI, node-express template | NFR-17 | 08 |

PRD sections 1 and 2 also state audience and user classes. These set context and create no requirement.

## Conflicts inside the PRD

| # | Conflict | Resolution | Outcome |
|---|---|---|---|
| F1 | The node-express template (§9) ships Polaris React 10.x, which Shopify has deprecated and archived, but §2 requires "latest" Polaris | Keep the template. Build screens with Polaris web components. Remove Polaris React | **Decided** |
| F2 | The mockup's "Timer position: Top" can't move an app block, whose place is set in the theme editor | `inline`, `top_bar`, `bottom_bar`. Bars use `position: fixed` | **Decided** |
| F3 | An async fetch can't satisfy "no CLS" alone: reserved space leaves a gap, and collapsing it is a shift | App-owned metafield hint, so Liquid reserves space only where a timer applies | **Decided** |
| F4 | Evergreen uses localStorage (§4.1), which has no session end, but must reset on "session end" | 30 minutes idle counts as session end | **Decided** |
| F5 | Widget size is ~15KB (§4.5) vs <30KB (§5.3). Shopify's guidance suggests 10KB compressed JS | Target 15KB, build fails above 30KB, 10KB tracked as advisory | Proposed |
| F6 | "Single API call" (§5.1) vs impression tracking, which needs a write. A cached read can't count impressions either | One call for config, plus a separate best-effort beacon | Proposed |
| F7 | "CLI 3.0" and template `^3.0.0` vs current CLI 5.0.1 | Treat 3.0 as the minimum; use current CLI; confirm in S1 | Proposed |
| F8 | The mockup lacks timer type, targeting and evergreen duration, and has one colour where §3 says "colors" | The form has the PRD's fields, inside the mockup's modal. Otherwise the mockup is a style reference | Proposed |

Also noted: §8 reads "48hrs days" with no start date. The user confirmed **24 hours or less** remain.

## Gaps the PRD leaves undefined

| # | Gap | Rule | Outcome |
|---|---|---|---|
| G1 | Several timers match one product | Product > collection > all, then soonest end, then latest update. One timer shows | **Decided** |
| G2 | Evergreen never expires, so it can only be stopped by deleting | Follow PRD §4.4: active, scheduled and expired only. No pause. Stopping a timer means deleting it, which also removes its impressions | **Decided** (user asked for a recommendation per the PRD) |
| G3 | Timezone of entered dates | Store UTC. Form uses the shop's `ianaTimezone` | Proposed |
| G4 | A cached response hides a timer starting within the cache window | Response carries ordered candidates, including those starting within 5 minutes. Client picks the live one | Proposed |
| G5 | Fixed timer reaches zero mid-view | Next live candidate, otherwise "Offer ended" in the same box. Bars hide | Proposed |
| G6 | What an impression is | At least 50% visible, once per page view | Proposed |
| G7 | Merchant edits an evergreen timer | Storage key carries the duration, so visitors restart only when the duration changes | Proposed |
| G8 | Hint goes stale when a timer expires, since nothing runs on a schedule | Hint stores start and end per entry, and Liquid compares them with `now` | Proposed |
| G9 | Whether the timer applies a discount | Display only. Stated as a README assumption | Proposed |
| G10 | A wrong client clock breaks "all users see the same countdown" | Accepted: correction is unreliable under caching. Discussed in Loom | Proposed |
| G11 | Timer lapses while Shopify's cached page still has old Liquid | Accepted: a mismatch until the page cache refreshes, with the duration measured in S2. Widget still validates against API data | Proposed |
| G12 | What urgency looks like, as the mockup only names "Color pulse" | No new colour field. The background fades between 100% and 70% opacity. Reduced motion swaps background and text colours | Proposed |
| G13 | Headline, description and countdown don't fit the smallest box | `small` shows headline and countdown on one row, with no description | Proposed |

## Other user decisions

| Topic | Decision |
|---|---|
| Database | Existing local MongoDB Community, not Docker or Atlas. 8.3.1 confirmed running on port 27017 |
| Workflow | Spec-driven. No development until specs and dependencies are reviewed and cleared |
| Commits | User's name only, with no `Co-Authored-By` line |
| Form | Modal, as in the mockup |
| Demo | CLI tunnel, no production deploy |
| Webhooks | Not in the PRD, so none are built. The template's stubs stay as shipped |

## Verified facts behind these decisions

Checked 2026-11-05.

| Fact | Source |
|---|---|
| `@shopify/polaris` is marked deprecated; its repo is archived | npm registry, GitHub API |
| Polaris web components 2.0 is the current stable version, with Date picker, Date field, Color picker, Color field, Modal and Table | shopify.dev |
| `shopify-app-template-node` is not archived. Its `web/frontend` is a submodule of `shopify-frontend-template-react` | GitHub API, `.gitmodules` |
| Template pins `@shopify/polaris ^10.49.1`, `react ^18.2.0`, `shopify-app-express ^5.0.8`, SQLite sessions | Template `package.json` files |
| App proxy strips cookies and adds `shop`, `timestamp`, `signature`, `path_prefix`, `logged_in_customer_id` | shopify.dev |
| `product.collections` in Liquid returns only collections available on the Online Store channel | shopify.dev |
| `vitest` engines exclude Node 25 | npm registry |
| The template's `web/privacy.js` has compliance webhook handlers that only parse the payload | Template source |

**Not verifiable from docs**, so tested in [10-spikes](10-spikes.md): caching behaviour through the app proxy, `app.metafields` read shape in block Liquid, `s-*` element behaviour in React 18, `resourcePicker` through the CDN script and above a modal, how long Shopify's page cache takes to reflect a metafield change, and how a stale session behaves after reinstalling.
