# 10. Verification Spikes

**Status:** Closed at Gate 2, 2026-11-05. Results below.

These are platform behaviours that documentation couldn't confirm. Each is time-boxed with a fallback, so none can block delivery. Spike code is throwaway. Only the results here, and any spec amendments, are kept.

**Needs from user first:** Node 24, Shopify CLI, development store and app registration ([PLAN](../PLAN.md#prerequisites-user)).

## S1. Scaffold and backend versions (45 min)

**Questions:**
1. Does `shopify app init` with the node template work on Node 24 and CLI 5, including the `web/frontend` submodule?
2. Can the backend move to `shopify-app-express` 8, Express 5 and MongoDB sessions?
3. Does Mongoose's MongoDB driver coexist with the session adapter's?
4. Is `read_products` or any other scope needed?
5. After uninstalling and reinstalling, does a stale session in MongoDB block the app, and is the app-owned metafield gone?

**Method:** scaffold in a scratch folder, upgrade, install on the dev store, load the embedded app, then restart and confirm the session survives.

**Pass:** the embedded app loads with a session stored in MongoDB.

**Fallbacks:**
- Upgrade fails: stay on the template's adapter 5.x line and its Express version, with the matching MongoDB session adapter version.
- Stale session blocks reinstall: when the Admin API rejects a stored token, delete the shop's sessions and send the merchant through authentication.

**Result:** done, on Node 24.22.2 and CLI 5.0.1, against the real store.

| Question | Result |
|---|---|
| 1. Scaffold | **Works.** `shopify app init --template <template URL> --client-id <id>` with npm. The frontend arrives as plain files, not a submodule, so nothing needs vendoring. It also creates `.git`, `CLAUDE.md` and `AGENTS.md`, which must not replace this repo's |
| 2. Adapter 8, Express 5, MongoDB sessions | **Works** after the code changes below, including a real embedded load and Admin API call |
| 3. Mongoose and session adapter drivers | **No conflict.** Both resolve to one `mongodb@7.8.0` |
| 4. Scopes | **None needed** for the shop timezone. (Later, in Slice D, the CLI began requiring `write_app_proxy` because the app has a proxy.) S2 and S4 found the same for metafield writes and the resource picker. The install screen still lists "View staff and contributor data: Store owner", which the app didn't request. The cause isn't confirmed |
| 5. Reinstall | **A stale session does block the app.** The old token gets a 401 from Shopify. Deleting the session and returning 401 with `X-Shopify-Retry-Invalid-Session-Request: 1` **fixed it in about a second**, with no merchant action. App Bridge retried, token exchange created a new session, and `afterAuth` fired. **The hint metafield is erased by uninstalling,** and the installation gets a new ID |

**Template code that must change for these versions:**
- `app.use("/api/*")` and `app.use("/*")` throw on Express 5. Use `app.use("/api", ...)` and a pathless `app.use(...)`.
- `LATEST_API_VERSION` no longer exists. Pin `ApiVersion.October26`.
- Remove the `restResources` import and the SQLite adapter.

**Auth behaviour observed:**

| Request | Auth code flow (dummy credentials) | Token exchange |
|---|---|---|
| API call, invalid token | 401 | 401, with a retry header |
| API call, no token | 302 to `/api/auth?shop=undefined` | 200, App Bridge HTML |
| Page load, embedded | Depends on stored session | Loads, with `frame-ancestors` set |

Neither returns the 401 that [04-api](04-api.md#errors) specifies for a missing token, so `/api` needs a small check before the library middleware. That check returned 401 as specified.

**Dev workflow notes:**
- A web process needs `roles = ["frontend", "backend"]` to serve page loads with a single server, otherwise the CLI's proxy returns "Invalid path".
- Once a theme extension exists, `shopify app dev` prompts for the store password, so it must run in an interactive terminal.
- `[app_proxy]` changes only take effect when `shopify app dev` restarts.
- Uninstalling removes the dev URL override, so the app then loads its released URL (`example.com`) until `shopify app dev` restarts.



## S2. Theme extension Liquid and metafield (30 min)

**Questions:**
1. In an app block on the product template, can Liquid read `product.id`, `product.collections`, and `'now' | date: '%s'`?
2. Can it read a JSON app-owned metafield through `app.metafields`, and loop over an array in it?
3. What are the correct namespace and owner for `metafieldsSet`, and does it need a scope?
4. Does Liquid's `contains` behave correctly on the delimited ID strings?
5. Do reading and looping over a hint at the size cap work, and what do they add to render time?
6. After a metafield write, how long does the storefront take to reflect it through Shopify's page cache?

**Method:** write a sample hint through GraphQL, and render diagnostic values from a test block.

**Pass:** matching and non-matching products produce the right Liquid decision.

**Fallback:** reserve fixed height on all product pages, and drop the hint. This reverses decision F3 in effect, so **the user is told** before the change is made.

**Result:** done, on your store's Horizon theme.

| Question | Result |
|---|---|
| 1. Liquid objects | **Works.** `product.id`, `product.collections` and `'now' \| date: '%s'` all read correctly |
| 2. Metafield read | **Works** as `app.metafields.countdown.timer_hint.value`, including looping over the array |
| 3. Namespace, owner, scope | Owner is the app installation. **No scopes needed.** Namespace `countdown` is read and tested. `$app:countdown` also writes, stored as `app--443890728961--countdown`, but its read path wasn't tested, so the spec uses `countdown` |
| 4. `contains` on delimited IDs | **Correct.** Exact product and collection IDs match. IDs one digit longer or shorter don't |
| 5. Hint at the size cap | **Shopify's limit is 131,072 bytes**, not the 256KB first assumed. A 127KB hint with 34 entries added no measurable time: median processing 25ms, against 30ms for 2 entries |
| 6. Metafield to storefront delay | **About 6 seconds,** which is the polling interval. Measured on a password-protected dev store, so public page caching could be slower |

Window and match decisions were all correct for evergreen, expired, live, lead-in, future and non-matching entries. The overflow marker reads correctly, and an overflow hint has no `t` array.

## S3. App proxy behaviour (30 min)

**Questions:**
1. Do `Cache-Control` and `ETag` reach the browser, and does a reload use the cache?
2. Does the signature verify with our implementation?
3. Does `sendBeacon` POST pass through, and with what content type?
4. Does it work on a password-protected development store?
5. Is the visitor's IP available in a trustworthy header?
6. How much latency does the proxy add?
7. Can a merchant customise the `/apps/countdown` path, and does it work with a locale-prefixed storefront URL?

**Method:** a stub `/proxy` route that logs headers. Exercise it from a storefront page.

**Pass:** a signed GET is verified, the browser caches it, and a beacon is received.

**Fallbacks:**
- Headers stripped: 30 second `sessionStorage` cache in the widget.
- Beacon fails: `fetch` with `keepalive`.
- No trustworthy IP: per-shop rate limit only.
- Customisable path: add a block setting for the path, defaulting to `/apps/countdown`.

**Result:** done.

| Question | Result |
|---|---|
| 1. Caching | **Works.** `Cache-Control` and `ETag` reach the browser. A repeat request came from the browser cache, with transfer size 0 |
| 2. Signature | **Valid** on every proxied request with the spec's method. An unsigned request returned 401 |
| 3. Beacon | **Works,** arriving as `text/plain;charset=UTF-8` |
| 4. Password-protected store | **Works** once the visitor has entered the password |
| 5. Visitor IP | `X-Forwarded-For` held the visitor's IP first, then a Cloudflare address from the dev tunnel. Not documented as trustworthy, so limits stay per shop |
| 6. Latency | 643ms for one request from the browser, through Shopify and the dev tunnel, so not a measure of server time |
| 7. Path | `/apps/countdown` works. `/en/apps/countdown` returned 404 on this single-language store, so locale prefixes are **not tested**. Whether merchants can customise the path is **not confirmed**, so this goes in the README as a known limit |

Proxied requests carry `shop`, `logged_in_customer_id`, `path_prefix`, `timestamp` and `signature`, and no cookies. The CLI says prefix and subpath changes only apply to new installs, though this proxy did work on the existing install.

## S4. Polaris web components in React (30 min)

**Questions:**
1. Under React 18, do `s-*` attributes and properties apply, and do change events fire?
2. Is there a usable time input?
3. Do `s-text-field`, `s-text-area`, `s-color-field`, `s-date-field`, `s-table`, `s-choice-list`, `s-select`, `s-number-field` and `s-modal` work as [06-admin](06-admin.md#form) assumes? Which components provide the dashboard's badge, banner, loading skeleton and "⋯" action menu?
4. Is `shopify.resourcePicker` available with the CDN script, with no extra scope?
5. Does the picker open correctly above an open `s-modal`?
6. Does the template's fetch attach the session token with the CDN App Bridge script, and what happens on a 401?

**Method:** one test page with each component, wired to React state, inside the embedded app.

**Pass:** a value round-trips through React state for each component, and the picker returns a selection.

**Fallbacks:**
- Events don't reach React: thin `ref`-based wrappers, or upgrade to React 19.
- No time component: `s-text-field` with time format validation.
- Picker can't stack over the modal: close the modal during selection and reopen it, keeping form state in React.

**Result:** done, on React 18.3.1 inside the embedded admin.

| Question | Result |
|---|---|
| 1. `s-*` under React 18 | **Works.** State set from React reaches each field's value. `s-button`'s `onClick` fires. Field changes arrive through `input` and `change` listeners on a `ref`, so a small wrapper component is all that's needed, and no move to React 19 |
| 2. Time input | **No time component.** `s-time-field` and `s-time-picker` don't exist. Use `s-text-field` with HH:mm validation |
| 3. Components | All present and working in the form: `s-text-field`, `s-text-area`, `s-date-field`, `s-color-field`, `s-select`, `s-number-field`, `s-choice-list`, `s-modal`. Rendered: `s-table` and its row and cell parts, `s-badge`, `s-banner`. `s-menu` is present but untested. `s-skeleton-paragraph` doesn't exist, so use `s-spinner` for loading |
| 4. Resource picker | **Works** through the CDN script with **no scopes,** for products and collections. Returns `{id, title}` with GIDs |
| 5. Picker over the modal | **Works.** It stacks on top of the open modal, so the close-and-reopen fallback isn't needed |
| 6. Session token | The global `fetch` attaches it automatically with the CDN App Bridge script, so the template's authenticated fetch hook isn't needed. The 401 path wasn't exercised in the browser |

`s-choice-list` reports its selection through `values` (an array), not `value`. Passing another resource type's IDs in `selectionIds` makes the picker show "Server error", so products and collections must keep separate lists. Opening the modal with `commandFor` works.

## Also verified along the way

| Item | During | Result |
|---|---|---|
| `helmet` config doesn't break admin embedding | S1 | `shopify.cspHeaders()` sets `frame-ancestors` and the app loads embedded. Slice A confirmed this with `helmet` on, with its CSP and frame options disabled |
| Preact 11 size against the 15KB target | S2 | 5.78KB gzipped for a small test widget |
| `shopify://admin/themes/current/editor` deep link format | S2 | The `https://admin.shopify.com/store/{store}/themes/current/editor?template=product&addAppBlockId={client_id}/{block_handle}` form added the block, in its own section. The `shopify://` form still needs testing from inside the app |
