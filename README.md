# Countdown Timer + Analytics (Shopify app)

Merchants create countdown timers in the Shopify admin and show them on product pages to add urgency to a promotion. Each timer counts its impressions.

Built from Shopify's node-express template on the MERN stack: MongoDB, Express, React and Node. The storefront widget is a Preact app block in a Theme App Extension.

## Features

- **Fixed timers:** a start and end date and time. Every visitor sees the same countdown, and the timer appears and ends on its own.
- **Evergreen timers:** each visitor gets their own countdown, such as 45 minutes from their first view. It survives reloads, and restarts after it ends or after 30 minutes idle.
- **Targeting:** all products, specific products or specific collections, chosen with Shopify's resource picker.
- **Appearance:** background and text colour, size (small, medium or large), position (inline where the block sits, top bar or bottom bar), headline and description.
- **Urgency cue:** the timer pulses when it nears its end. Visitors who prefer reduced motion see a colour swap instead.
- **Dashboard:** every timer with its status (active, scheduled or expired), type, targeting, schedule and impression count. It has search, a status filter, sorting and a warning when timers compete for the same products.
- **Impressions:** counted when at least half the timer is visible, once per page view.

## Setup

### Prerequisites

- Node.js 24 LTS. Node 25 isn't supported by vitest.
- MongoDB 8.x running locally on `mongodb://127.0.0.1:27017`. No Docker is needed.
- A Shopify Partner account and a development store. The app was tested with the [home-and-garden sample products](https://github.com/shopifypartners/product-csvs/blob/master/home-and-garden.csv).
- Shopify CLI 5.0.1, installed as a dependency, so `npm run` uses it.

### Run it

```sh
git clone https://github.com/athul-ts/MyDukaan.git
cd MyDukaan
npm install
npm run dev
```

`npm run dev` runs `shopify app dev`, which:
1. Asks you to log in and choose a Partner organization.
2. Links an app. `shopify.app.toml` points to the author's app, so run `npm run shopify app config link` first to create or choose your own.
3. Asks for a development store, and that store's password. This prompt needs an interactive terminal.
4. Starts a tunnel and prints a link. Open it, and install the app.

The CLI supplies `SHOPIFY_API_KEY`, `SHOPIFY_API_SECRET`, `SCOPES` and `HOST`. The only local setting is `MONGODB_URI`, which defaults to `mongodb://127.0.0.1:27017/countdown_timer`. To change it, copy `.env.example` to `.env`. Never commit `.env`.

### Show a timer on the store

1. In the app, click **Add the timer block to your theme**. The theme editor opens on a product page.
2. Place the **Countdown Timer** block, for example under the price, and save.
3. Back in the app, click **Create timer**, fill in the form and save.
4. Open a product the timer targets. The countdown should appear within about 30 seconds.

### Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Runs the app through the Shopify CLI |
| `npm test` | Runs 202 unit and integration tests. Integration tests need the local MongoDB, and use their own `countdown_timer_test` database |
| `npm run lint` | ESLint |
| `npm run build:widget` | Builds the widget into `extensions/countdown-timer/assets/countdown-timer.js`. The built file is committed, so run this after changing `widget/` or the shared rules it uses |
| `npm run check:size` | Builds the widget and fails if it exceeds 30KB gzipped |
| `npm run perf:proxy` | Load-tests the storefront API with 200 timers. It uses a temporary database, which it deletes afterwards |

## Architecture

```
Admin (React, Polaris web components, App Bridge)
   │  session token
   ▼
Express API  /api ──────────────► MongoDB: timers, timer_stats, shop_state, sessions
   │  after each save
   ▼
App-owned metafield "hint" ──► Product page Liquid decides, before paint, whether to reserve space
                                    │  only on matching products
                                    ▼
                              Preact widget ──► /apps/countdown (Shopify app proxy, signed)
                                                    │
                                                    ▼
                                              Express /proxy: timers (cached), impressions
```

```
web/                     Express app: routes/, middleware/, repositories/, services/, models/
web/frontend/            Admin app (React + Vite)
shared/                  Pure business rules shared by server, admin and widget, with tests
widget/                  Preact widget source
extensions/countdown-timer/   App block Liquid and the built widget
scripts/                 Widget build, size check, load test
tests/                   Unit and integration tests
specs/                   Requirements, decisions, API contract, test plan
```

## Architecture decisions

| Decision | Why |
|---|---|
| **Theme App Extension app block**, never ScriptTag | Required by the PRD. Merchants place it in the theme editor, and it uninstalls cleanly |
| **App proxy for the storefront API** | Shopify signs each request with the app secret, so the server can trust the shop without a token in the browser. It's same-origin, so no CORS is needed |
| **A metafield "hint" decides layout before paint** | A fetch can't avoid layout shift by itself: if space is reserved, products without a timer get a gap, and if it isn't, the timer pushes the page down. So after each save the server writes a small list of start times, end times, sizes and target IDs to an app-owned metafield. The block's Liquid checks the current product against it and reserves exact space only where a timer will show. Products with no timer get no script and no API call. The hint holds no merchant text |
| **Status is derived, never stored** | Active, scheduled or expired is worked out from the dates when read, so no scheduled job is needed and status can't go stale |
| **Pure rules in `shared/`** | Status, selection, evergreen state, validation and the hint builder are pure functions with tests. Server, admin and widget share them, so they can't disagree. The widget imports only what it needs, never zod |
| **Up to 3 ranked candidates per response** | The widget gets the live timer plus any starting within 5 minutes, and switches between them on its own. A cached response can then still start a timer on time |
| **One timer per product** | When several match: product beats collection beats all, then the soonest end, then the most recently updated |
| **Evergreen state in `localStorage`** | Keyed by timer and duration, so changing the duration restarts visitors but fixing a typo doesn't. 30 minutes idle counts as the end of a session, since `localStorage` has no session end of its own. If storage is blocked, the countdown keeps its state in memory for the page view |
| **Impressions in their own collection** | Frequent counter writes never touch timer documents. Counted with an atomic `$inc` |
| **Polaris web components** from Shopify's CDN | The template's Polaris React package is deprecated, and the PRD asks for current Polaris |
| **Create and edit in a modal** | Matches the PRD's admin mockup |
| **Token exchange** for admin auth | Suits Shopify's managed install and recovers from a stale session by itself. This departs from the template's OAuth redirect flow |
| **MongoDB sessions** | Replaces the template's SQLite, so there is one datastore and no native build |
| **Bars move to `<body>`** | Themes such as Horizon put sections in their own stacking layer, which let page content paint over a fixed bar. The widget moves a bar to `<body>` before paint and leaves a spacer, so nothing shifts |

## Performance

| Measure | Result | Target |
|---|---|---|
| Widget JS + CSS, gzipped | 9.56KB (JS alone 8.92KB) | ≤15KB, build fails above 30KB |
| `GET /proxy/timers`, server-side, 200 timers, 10 concurrent | p50 7.2ms, p95 11.6ms, p99 16.9ms | p95 under 200ms |
| Lighthouse CLS, mobile, on the dev store | 0 on products with a timer | 0 from the widget |

On a product with no timer, Lighthouse measured CLS 0.008. The widget doesn't load on that page, so the shift comes from the theme. The API figures exclude the Shopify CLI tunnel and Shopify's proxy, which add latency outside the app's control.

**Optimizations:**
- Products with no timer load no widget script and make no API call.
- Space is reserved before first paint, and the box never changes size: an ended timer shows "Offer ended" inside the same box.
- Browser caching: `Cache-Control: public, max-age=30, stale-while-revalidate=120`, with an ETag. Errors are never cached.
- One config request per page view, with no interval polling. The widget refetches only when the tab returns after 5 minutes, or once after every timer has ended.
- The countdown is recalculated from the clock each second, aligned to second boundaries, so it doesn't drift. Digits sit in fixed-width cells, so the width never jitters.
- The pulse animates only opacity, which doesn't trigger layout.
- Lean, indexed, per-shop MongoDB queries. A shop can have at most 200 timers.
- The widget is Preact, bundled with esbuild into one minified script that loads with `defer`.

## Security

- **Shop verification:** admin calls need a valid App Bridge session token. Storefront calls need a valid app proxy signature, checked with a constant-time comparison. `shop` comes only from the verified session or signature, never from the request body or query.
- **Tenant isolation:** all data access goes through repositories that require `shop`. Another shop's timer returns 404.
- **Input:** every request is validated with strict zod schemas. Unknown keys are rejected, HTML and control characters are stripped, and colours must be hex. Mongoose `sanitizeFilter` is on as a second layer.
- **XSS:** merchant text is rendered only as Preact text nodes. Liquid never outputs merchant text.
- **No exposed data:** storefront responses are built from an explicit allowlist. Timer names, targeting lists and impression counts are never public. Client code holds no secrets.
- **Headers:** `helmet`, with its frame and content security policies replaced by Shopify's per-shop `frame-ancestors`, so the admin still loads in its iframe.

## Rate limiting

`express-rate-limit` with an in-memory store, keyed by the verified shop:

| Routes | Limit |
|---|---|
| `/api/*` | 120 per minute per shop |
| `GET /proxy/timers` | 3000 per minute per shop |
| `POST /proxy/impressions` | 3000 per minute per shop |

Limits are per shop, not per visitor, because Shopify doesn't document whether the visitor IP forwarded through the app proxy can be trusted. Storefront limits are generous, since all of a shop's visitors share one key and a wrongly limited request only hides a timer. Over the limit, the API returns 429 with `Retry-After`, and the widget renders nothing and doesn't retry.

## API

Every error has the same shape and status codes 400, 401, 404, 422, 429 or 500:
`{"error": {"code": "VALIDATION_FAILED", "message": "Timer is invalid", "details": [{"path": "endAt", "message": "..."}]}}`

| Method and path | Auth | Purpose |
|---|---|---|
| `GET /api/timers?status&q&sort&page&pageSize` | Session token | Paged list with status and impressions |
| `POST /api/timers` | Session token | Create a timer (201) |
| `GET /api/timers/:id` | Session token | One timer |
| `PUT /api/timers/:id` | Session token | Replace a timer |
| `DELETE /api/timers/:id` | Session token | Delete a timer and its impressions |
| `GET /api/shop` | Session token | Shop timezone for the form |
| `POST /api/hint/sync` | Session token | Retry writing the storefront hint |
| `GET /proxy/timers?productId&collectionIds` | Proxy signature | Up to 3 ranked timers for a product, cached |
| `POST /proxy/impressions` | Proxy signature | Count an impression `{timerId}`, returns 202 |

Create, update and delete also return `hintSync: "ok" | "failed"`. A failed hint write never fails the save, and the dashboard offers a retry.

Full details: [specs/04-api.md](specs/04-api.md). Machine-readable contract: [specs/openapi.yaml](specs/openapi.yaml).

## Assumptions

- **Display only:** timers don't create or apply discounts. The PRD mentions discounts only as the reason to show a timer. A merchant creates the discount in Shopify, and matches its dates to the timer by hand.
- **Shopify CLI:** the PRD names CLI 3.0. This project uses 5.0.1, treating 3.0 as a minimum.
- **Product pages only:** the block is limited to product templates.
- **No hosting:** the demo runs through the Shopify CLI tunnel.
- **Statuses:** the PRD's three statuses: active, scheduled and expired. To stop a timer, delete it.
- **Times:** dates are entered in the shop's timezone and stored in UTC. A fixed timer counts down by the visitor's device clock, so a wrong clock shows a wrong countdown.
- **Scope:** `write_app_proxy` is the only scope requested. Shopify requires it for an app proxy, and nothing else is needed.

## Known limitations

- **Bars cover content:** a top or bottom bar sits over the page rather than pushing it down, since pushing would shift the layout. A top bar covers the store's announcement bar, and a medium or large one also covers part of the header.
- **Editor selection:** in the theme editor, clicking a bar may not select its block. The sidebar still does.
- **Late page loads:** a page opened more than 5 minutes before a timer starts doesn't show that timer until it's reloaded.
- **Edit delay:** an edit reaches visitors within about 30 seconds, or 150 seconds in the worst case through the browser cache. Shopify's page cache took about 6 seconds to reflect a hint change on the dev store.
- **Collections:** only Online Store collections match, as Liquid reports only those. Only a product's first 50 collections are checked.
- **Evergreen urgency:** after an evergreen countdown ends, it restarts on the visitor's next page load. This follows the PRD, but a visitor can see it restart.
- **Reinstalling:** uninstalling removes the block from the theme, as Shopify does for all app blocks, so it has to be added again. Timers and impressions are kept, and the app rebuilds its storefront data on reinstall.
- **Deleting loses impressions:** deleting a timer also deletes its impression count.
- **Impression totals:** impressions are a running total per page view, not unique visitors, and include any bot that runs JavaScript.
- **Hint size:** a hint over 120KB is replaced by an overflow marker. Pages then fetch on every product, which can cause a small layout shift.
- **Webhooks:** no webhooks are built. The PRD doesn't ask for them. The template's compliance handlers stay as shipped, and an App Store listing would need real ones.
- **Rate limits:** stored in memory, so they apply per server instance.

## What I'd improve with more time

- An on/off switch, so a merchant can pause a timer without deleting it.
- Daily impression history and unique visitors, rather than one total.
- Optionally creating a matching Shopify discount for a timer.
- Correcting the visitor's clock with a server time offset.
- Hosting with CI.
- Compliance webhooks, for an App Store listing.

## Project documents

Built spec-first. Each requirement maps to a test or a manual check.
- [specs/README.md](specs/README.md): index of the specs
- [specs/00-derivation.md](specs/00-derivation.md): how each PRD line became a requirement, plus every conflict and gap in the PRD and how it was decided
- [specs/09-test-plan.md](specs/09-test-plan.md): automated tests and manual store checks
- [PLAN.md](PLAN.md): delivery plan and status
