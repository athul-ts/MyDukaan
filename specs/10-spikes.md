# 10. Verification Spikes

**Status:** Open. Must close before Gate 2.

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

**Result:** _in progress. The parts below ran with dummy credentials on Node 24.22.2; the checks against the real store need a login._

| Question | Result |
|---|---|
| 1. Template scaffold | Clones with its submodule. Through `shopify app init` and CLI 5: **not run yet** |
| 2. Adapter 8, Express 5, MongoDB sessions | **Works** after the code changes below. The server boots, and a session saves and loads from MongoDB |
| 3. Mongoose and session adapter drivers | **No conflict.** Both resolve to one `mongodb@7.8.0` |
| 4. Scopes | **Not run yet.** The template asks for `write_products`, which this app shouldn't need |
| 5. Reinstall and stale sessions | **Not run yet** |

**Template code that must change for these versions:**
- `app.use("/api/*")` and `app.use("/*")` throw on Express 5. Use `app.use("/api", ...)` and a pathless `app.use(...)`.
- `LATEST_API_VERSION` no longer exists. Pin `ApiVersion.October26`.
- Remove the `restResources` import and the SQLite adapter.

**Auth behaviour observed:**

| Request | Auth code flow | Token exchange |
|---|---|---|
| API call, invalid token | 401 | 401, with a retry header |
| API call, no token | 302 to `/api/auth?shop=undefined` | 200, App Bridge HTML |
| Page load, embedded | Depends on stored session | Loads, with `frame-ancestors` set |

Neither returns the 401 that [04-api](04-api.md#errors) specifies for a missing token, so `/api` needs a small check before the library middleware. The `frame-ancestors` header is set by `shopify.cspHeaders()`, as [07](07-nfr-security.md#http-headers) expects.

## S2. Theme extension Liquid and metafield (30 min)

**Questions:**
1. In an app block on the product template, can Liquid read `product.id`, `product.collections`, and `'now' | date: '%s'`?
2. Can it read a JSON app-owned metafield through `app.metafields`, and loop over an array in it?
3. What are the correct namespace and owner for `metafieldsSet`, and does it need a scope?
4. Does Liquid's `contains` behave correctly on the delimited ID strings?
5. Do reading and looping over a 256KB hint work, and what do they add to render time?
6. After a metafield write, how long does the storefront take to reflect it through Shopify's page cache?

**Method:** write a sample hint through GraphQL, and render diagnostic values from a test block.

**Pass:** matching and non-matching products produce the right Liquid decision.

**Fallback:** reserve fixed height on all product pages, and drop the hint. This reverses decision F3 in effect, so **the user is told** before the change is made.

**Result:** _not run_

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

**Result:** _not run_

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

**Result:** _not run_

## Also verified along the way

| Item | During | Result |
|---|---|---|
| `helmet` config doesn't break admin embedding | S1 | _not run_ |
| Preact 11 size against the 15KB target | S2 | _not run_ |
| `shopify://admin/themes/current/editor` deep link format | S2 | _not run_ |
