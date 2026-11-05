# 08. Dependencies

**Status:** Approved (Gate 1, 2026-11-05) | **Implements:** NFR-14, 16, 17

"Latest" was read from the npm registry on 2026-11-05. **Exact pins are set at Gate 2**, after the spikes. A dependency not listed here must be added here before it's installed.

## Environment

| Item | Required | Current on this machine | Action |
|---|---|---|---|
| Node.js | **24 LTS** | 24.22.2, through nvm | None. `vitest` excludes Node 25 (`^22.12 \|\| ^24 \|\| >=26`), so stay on 24 for this project |
| npm | Bundled with Node | 11.19.1 | None. It holds back install scripts not yet allowed, so S1 checks whether esbuild needs allowing |
| Shopify CLI | Current (PRD's 3.0 treated as a minimum, F7) | 5.0.1 | None |
| MongoDB | 8.x | **8.3.1 running on :27017** | None |
| Git, GitHub CLI | Any recent | 2.54.0, 2.92.0 | None |
| Docker | Not required | 29.4.2 | Not used (user decision) |
| `mongosh` | Not required | Not installed | Not needed |

## Backend

| Package | Latest | Template has | Plan and constraints |
|---|---|---|---|
| `@shopify/shopify-app-express` | 8.0.3 | ^5.0.8 | Upgrade in S1. v8 needs Node ≥22 and Express 5. Fallback: stay on the 5.x line |
| `@shopify/shopify-app-session-storage-mongodb` | 8.0.1 | SQLite adapter ^4 | Replaces SQLite. Needs Node ≥22. Version must match the express adapter line |
| `express` | 5.3.0 | Not listed directly, S1 confirms the version | Express 5 is required as a peer by adapter v8 |
| `mongoose` | 9.11.4 | None | Bundles `mongodb ~7.7`. S1 checks for conflict with the session adapter's driver |
| `zod` | 4.6.7 | None | Shared by server and admin. Never imported by the widget |
| `helmet` | 8.3.0 | None | Default CSP and frame options disabled ([why](07-nfr-security.md#http-headers)) |
| `express-rate-limit` | 8.7.3 | None | In-memory store |
| `compression`, `serve-static`, `cross-env` | Template versions | Yes | Kept as they are |

## Admin

| Package | Version | Note |
|---|---|---|
| Polaris web components | CDN `polaris-2.js` | Stable 2.x channel, no npm package. Replaces `@shopify/polaris` |
| App Bridge | CDN `app-bridge.js` | Unversioned; Shopify serves the latest. Provides `shopify.resourcePicker` per **[S4]** |
| `@shopify/app-bridge-react` | Template ^4.1.3 (latest 4.2.14) | Keep if the template's authenticated fetch and routing need it; otherwise remove |
| `react`, `react-dom` | Template ^18.2.0 (latest 19.3.1) | Stay on 18. Move to 19 only if S4 requires it, as 19 has native custom element support |
| `react-router-dom` | Template ^6.3.0 (latest 7.18.5) | Leave on the template's version |
| `react-query` | Template ^3.34.19 | Leave on the template's version |
| `vite` | Template ^5.4.0 (latest 8.3.5) | Leave on the template's version |
| `date-fns`, `date-fns-tz` | To confirm at Gate 2 | Shop timezone conversion |
| **Removed** | `@shopify/polaris`, its i18n and icon packages | Deprecated (F1) |

The admin's other template packages stay on the template's versions, because upgrading them adds risk without helping any requirement in a time-boxed build.

## Widget

| Package | Latest | Note |
|---|---|---|
| `preact` | 11.1.1 | Measure actual size in S2. Fall back to 10.x if it threatens the 15KB target |
| `esbuild` | 0.28.2 | Dev only. Produces the minified IIFE bundle |

## Quality

| Package | Latest | Note |
|---|---|---|
| `vitest` | 5.1.0 | Needs Node 22.12+, 24, or 26+ |
| `supertest` | 7.3.1 | API integration tests |
| `eslint` | 10.14.0 | Needs Node ^20.19, ^22.13 or ≥24 |

`mongodb-memory-server` isn't used. Tests run against a dedicated database on the local MongoDB, which avoids a large binary download and matches the real server.

## External services and accounts

| Service | Used for | Status |
|---|---|---|
| Shopify Partner account | App registration, dev store | Exists |
| Shopify dev store + sample CSV | Testing and demo | **To create** |
| Cloudflare tunnel | Provided automatically by `shopify app dev` | No setup |
| GitHub | Submission | Exists |
| Loom | Submission video | **Account to confirm** |

## Shopify configuration

To be finalized in S1 and S2, in `shopify.app.toml`:

```toml
[access_scopes]
scopes = ""  # Least privilege. S2 confirms whether read_products is needed

[app_proxy]
url = "<app url>/proxy"
subpath = "countdown"
prefix = "apps"
```

## Environment variables

Listed in `.env.example`, with values only in the gitignored `.env`:

`SHOPIFY_API_KEY`, `SHOPIFY_API_SECRET`, `SCOPES`, `HOST` (set by the CLI), `MONGODB_URI=mongodb://127.0.0.1:27017/countdown_timer`.

## Known compatibility risks

| Risk | Handled by |
|---|---|
| Template's `@shopify/cli ^3.0.0` vs current CLI 5 | S1 |
| Template written for adapter v5, on an Express version S1 confirms | S1, 45 minute box, with fallback |
| Two MongoDB driver versions, from Mongoose and the session adapter | S1. Separate connections are acceptable |
| `web/frontend` is a git submodule, but we need to change it | Vendored into the repo in slice A |
| Native dependency builds on Node 24 on Windows | Removing SQLite eliminates the main one |
