# 04. API

**Status:** Approved (Gate 1, 2026-11-05) | **Implements:** FR-11, 13, 16; NFR-2, 3, 8, 10, 12, 13 | **Contract:** [openapi.yaml](openapi.yaml)

## Surfaces

| Surface | Base | Authentication |
|---|---|---|
| Admin | `/api` | App Bridge session token, `shopify.validateAuthenticatedSession()` |
| Storefront | `/proxy`, reached by browsers at `/apps/countdown` on the shop's domain | App proxy HMAC signature |

### Why an app proxy

The widget must call the API with a verified shop. A direct call with `?shop=` could be spoofed by anyone. An app proxy has Shopify sign each request, is same-origin so needs no CORS, and exposes no secret in the browser. The signature proves the request came through Shopify for that shop, which is the check this public data needs. It doesn't identify a customer, and the app stores no customer data.

## Admin endpoints

| Method and path | Success | Purpose |
|---|---|---|
| `GET /api/timers?status&q&sort&page&pageSize` | 200 | Paged list with derived status and impressions, plus the shop's `hintSync` state |
| `POST /api/timers` | 201 | Create, syncs hint |
| `GET /api/timers/:id` | 200 | One timer |
| `PUT /api/timers/:id` | 200 | Full replace, syncs hint |
| `DELETE /api/timers/:id` | 200 | Delete timer and stats, syncs hint |
| `GET /api/shop` | 200 | `{ianaTimezone, domain}` for the form |
| `POST /api/hint/sync` | 200 | Rebuilds the hint from MongoDB and returns `{hintSync}` |

**List parameters:** `status` is `active`, `scheduled` or `expired`, translated into date conditions so filtering and paging stay in the database. `q` is a case-insensitive name search with regex characters escaped. `sort` is `createdAt_desc` (default), `endAt_asc` or `name_asc`. `endAt_asc` puts evergreen timers last. `page` starts at 1. `pageSize` defaults to 20, max 50.

**Hint sync:** create, update and delete return `hintSync: "ok" | "failed"`. A sync failure never fails the save. The state is stored per shop ([`shop_state`](03-data-model.md#shop_state)), so the list reports it after a reload until a later sync succeeds. The hint is rebuilt from MongoDB after each write, with writes queued per shop, so concurrent saves can't leave it out of date.

## Storefront endpoints

### `GET /proxy/timers?productId=123&collectionIds=4,5,6`

- `productId` is required and numeric. `collectionIds` is optional: numeric, comma-separated, up to 50.
- Returns up to 3 ranked candidates ([selection](02-domain-rules.md#selection)).
- No candidates: 200 with `{"timers": []}`.

```json
{
  "timers": [{
    "id": "665f0c...",
    "type": "fixed",
    "startAt": "2026-11-29T00:00:00.000Z",
    "endAt": "2026-11-30T00:00:00.000Z",
    "durationMinutes": null,
    "headline": "Offer ends in",
    "description": "50% off",
    "style": { "backgroundColor": "#111111", "textColor": "#FFFFFF", "size": "medium", "position": "inline" },
    "urgency": { "mode": "color_pulse", "thresholdMinutes": 5 }
  }]
}
```

These fields are an **explicit allowlist**, built by a dedicated serializer. `name`, `shop`, targeting, impressions and internal timestamps are never included.

### `POST /proxy/impressions`

Body `{"timerId": "..."}`. Accepts `text/plain` as well as JSON, since `sendBeacon` may send either. Returns 202 with no body after checking the timer belongs to the signed shop. An unknown or malformed timer ID returns 404, and malformed JSON returns 400. The widget ignores both. S3 confirmed `sendBeacon` POSTs pass through the proxy, arriving as `text/plain;charset=UTF-8`.

## Proxy signature verification

Per Shopify's documented method:

1. Parse the raw query string, URL-decode keys and values, and group repeated keys, joining values with `,`.
2. Remove `signature`, build `key=value` strings, sort them, and join with no separator.
3. Compute HMAC-SHA256 hex with the app's shared secret.
4. Compare using `crypto.timingSafeEqual`. Any failure or missing signature returns 401.
5. Check `shop` against `^[a-z0-9-]+\.myshopify\.com$`, then use it as the tenant key.

Shopify documents no freshness window, so `timestamp` isn't enforced. Replay only re-reads public display data or adds an impression, which rate limits contain.

## Errors

All error responses use one shape, and carry `Cache-Control: no-store`:

```json
{ "error": { "code": "VALIDATION_FAILED", "message": "Timer is invalid", "details": [{ "path": "endAt", "message": "Must be after start" }] } }
```

| Status | Code | When |
|---|---|---|
| 400 | `BAD_REQUEST` | Malformed JSON or query parameter |
| 401 | `UNAUTHORIZED` | Missing or invalid session or signature |
| 404 | `NOT_FOUND` | Missing ID, malformed ID, or another shop's resource |
| 422 | `VALIDATION_FAILED` | Well-formed input that breaks a rule, or the per-shop timer limit |
| 429 | `RATE_LIMITED` | Limit exceeded, with `Retry-After` |
| 500 | `INTERNAL` | Unexpected. Logged server-side, with no internals in the response |

## Caching

| Response | Headers |
|---|---|
| `GET /proxy/timers` 200 | `Cache-Control: public, max-age=30, stale-while-revalidate=120`, plus ETag with 304 support |
| Admin responses | `Cache-Control: no-store` |
| All errors | `Cache-Control: no-store` |

A merchant edit typically reaches visitors within 30 seconds. A visitor revisiting inside the stale window may see the old version once, so the worst case is 150 seconds. Timer starts and ends are unaffected, since the client evaluates the absolute times locally.

The URL's `collectionIds` are sorted in Liquid so one product has one cache key.

S3 confirmed these headers reach the browser, and that a repeat request is served from its cache, so no `sessionStorage` fallback is needed.

## Rate limiting

`express-rate-limit`, with an in-memory store, suits this single-instance demo.

| Route group | Limit | Key |
|---|---|---|
| `/api/*` | 120 per minute | Shop from session |
| `GET /proxy/timers` | 3000 per minute | Shop |
| `POST /proxy/impressions` | 3000 per minute | Shop |

S3 showed the visitor's IP inside `X-Forwarded-For`, but no Shopify documentation says it can be trusted, so limits aren't per visitor. Storefront limits are generous per shop because all of a shop's visitors share that key, and a false limit only hides a timer. On 429 the widget renders nothing and doesn't retry. Moving to a shared Redis store for multiple instances is documented in the README.

## Webhooks

None are built, because the PRD doesn't ask for them. The template's `web/privacy.js` handlers only parse the payload and do nothing else. They stay as shipped, and no app code depends on them.

The README notes that listing on the App Store would require real compliance handling.
