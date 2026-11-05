# 03. Data Model

**Status:** v1.0 (Gate 2, 2026-11-05) | **Implements:** FR-4, 10, 11, 16; NFR-5, 11

Database: `countdown_timer` on local MongoDB 8.3. Tests use a separate `countdown_timer_test` database.

## `timers`

| Field | Type | Notes |
|---|---|---|
| `_id` | ObjectId | |
| `shop` | string, required | `*.myshopify.com`. Tenant key |
| `name` | string | Merchant-only, never public |
| `type` | `fixed` \| `evergreen` | |
| `startAt`, `endAt` | Date \| null | UTC. Fixed only |
| `durationMinutes` | int \| null | Evergreen only |
| `headline`, `description` | string | Sanitized plain text |
| `style` | object | `backgroundColor`, `textColor`, `size`, `position` |
| `urgency` | object | `mode`, `thresholdMinutes` |
| `targeting.scope` | `all` \| `products` \| `collections` | |
| `targeting.productIds[]` | string[] | Numeric IDs, for matching |
| `targeting.collectionIds[]` | string[] | Numeric IDs, for matching |
| `targeting.labels[]` | `{id, title}[]` | GID and title snapshot for admin display. A title may go stale if renamed in Shopify, which is acceptable |
| `createdAt`, `updatedAt` | Date | `updatedAt` is the recency tie-break in selection |

Status is not stored ([02-domain-rules](02-domain-rules.md#status)).

The API exchanges targeting as `products[]` and `collections[]` of `{id, title}` with full GIDs. On write, the server stores numeric IDs for matching and keeps the GID and title in `labels` for display. On read, it rebuilds the API shape from `labels`.

### Indexes

| Index | Serves |
|---|---|
| `{shop: 1, endAt: 1}` | Widget fetch |
| `{shop: 1, createdAt: -1}` | Dashboard default order |

The widget query is below. With at most 200 timers per shop, the targeting checks run over a small indexed range, so no multikey indexes are needed. Check A-3 in the [test plan](09-test-plan.md) measures this against NFR-5.

```js
{
  shop,
  $and: [
    { $or: [{ type: 'evergreen' }, { endAt: { $gt: now }, startAt: { $lte: nowPlus5Min } }] },
    { $or: [
      { 'targeting.scope': 'all' },
      { 'targeting.productIds': productId },
      { 'targeting.collectionIds': { $in: collectionIds } },
    ] },
  ],
}
```

## `timer_stats`

| Field | Type | Notes |
|---|---|---|
| `shop` | string | Tenant key |
| `timerId` | ObjectId | |
| `impressions` | int | Running total, incremented with `$inc` and upsert |
| `lastImpressionAt` | Date | |

Unique index: `{shop: 1, timerId: 1}`.

Stats live apart from config because counters change on every page view. Writing them to `timers` would change config documents constantly and add write contention to the read path. Deleting a timer deletes its stats.

## `shop_state`

| Field | Type | Notes |
|---|---|---|
| `shop` | string | Tenant key. Unique index |
| `hintSyncFailedAt` | Date \| null | Set when a hint write fails, cleared when one succeeds |

This keeps the dashboard's sync warning across reloads.

## Sessions

Managed by `@shopify/shopify-app-session-storage-mongodb` in its own collection. It replaces the template's SQLite, so the app has one datastore and needs no native SQLite build.

## App-owned metafield (not MongoDB)

A derived copy of targeting and schedule, written to Shopify so Liquid can read it. Format in [05-widget](05-widget.md#metafield-hint). MongoDB remains the source of truth, and the hint can always be rebuilt from it.

## Tenant isolation

- Every repository method takes `shop` as its required first argument, and every query includes it. A missing `shop` throws.
- `shop` comes only from `res.locals.shopify.session.shop` or the verified proxy signature, never from a body or query parameter.
- A lookup by ID filters on both `_id` and `shop`. Another shop's ID returns 404, so existence isn't revealed.
- The impression beacon confirms the timer belongs to the signed shop before incrementing.
- Inputs reach queries only after schema validation. Mongoose `sanitizeFilter` is enabled as a second layer. Because it neutralises `$`-operators, operators in filters the server builds itself, such as the widget query's `$gt`, `$lte` and `$in`, are wrapped in `mongoose.trusted()`. Never wrap a value that comes from a request.

## Data lifecycle

| Event | Action |
|---|---|
| Timer deleted | Delete its `timer_stats`, rebuild hint |
| App uninstalled | No action, as webhooks are out of scope. Data stays in the local database |
| App reinstalled | S1 confirmed that uninstalling erases the hint and leaves a stale session. On a 401 from the Admin API, the app deletes the session and returns 401 with the retry header. App Bridge retries, token exchange creates a new session, and `afterAuth` rebuilds the hint from MongoDB |
