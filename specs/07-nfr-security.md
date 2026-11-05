# 07. Performance and Security

**Status:** v1.0 (Gate 2, 2026-11-05) | **Implements:** NFR-4, 5, 6, 7, 8, 9, 10, 11, 12; DEL-5

## Performance budgets

| Metric | Target | Limit | Measured by |
|---|---|---|---|
| Widget JS + CSS, gzipped | ≤15KB | 30KB, build fails | `npm run check:size` |
| Shopify's advisory for schema-referenced JS | 10KB compressed | Advisory only | Reported by `check:size` |
| `GET /proxy/timers`, server-side p95 | <100ms | 200ms | Load script against the local DB, 200 timers in one shop |
| CLS from widget | 0 | 0 | Lighthouse and the Performance panel, on matching and non-matching products |

The 200ms target applies to the app's processing time. The dev tunnel and Shopify's proxy add latency outside the app's control, so that total is measured and reported separately.

## Optimizations to document (DEL-5)

- Non-matching products load no script and make no API call.
- Browser caching with `stale-while-revalidate`.
- Lean, indexed, per-shop queries with field projection.
- Counters kept in a separate collection from config.
- No interval polling.
- Minimal bundle: Preact and only needed shared functions.
- Pulse animates compositor-only properties.

## Security controls

| Threat | Control | Check |
|---|---|---|
| Spoofed shop on the storefront API | App proxy HMAC, constant-time compare; `shop` read only after verification | T-5 |
| Cross-tenant read or write | Repository requires `shop`; other shops' IDs return 404 | T-6 |
| Forged impressions across shops | Beacon confirms the timer belongs to the signed shop | T-6 |
| Unauthenticated admin access | Session token middleware on all `/api/*` | T-9 |
| Stored XSS | Tags stripped on write, text-node-only rendering, Liquid never prints merchant text | T-4, M-9 |
| CSS injection through colours | Hex regex on write and at render | T-4 |
| NoSQL injection | Schema validation before queries, Mongoose `sanitizeFilter` | T-4 |
| Regex injection in search | `q` is escaped before use | T-9 |
| Data leak through the public API | Serializer allowlist, tested to have exact keys | T-7 |
| Secret exposure | Secrets are server-side in `.env` only, which is gitignored. `.env.example` has placeholders | M-24 |
| Abuse and flooding | Rate limits, JSON body limit of 10KB on proxy routes | T-9 |
| Leaked error internals | Central handler returns generic 500s, details stay in logs | T-9 |

## HTTP headers

`helmet` is used on API responses, **with its default `Content-Security-Policy` and `X-Frame-Options` disabled**. Those defaults would stop the app loading inside the Shopify admin iframe. The Shopify library sets the required `frame-ancestors` per shop instead, which slice A confirmed in the admin.

## Trust boundaries

| Input | Trust | Handling |
|---|---|---|
| Admin request body | Authenticated, not trusted | Schema-validated and sanitized |
| Proxy `shop` | Trusted only after HMAC | Regex check as well |
| Proxy `productId`, `collectionIds` | Signed by Shopify but set by the visitor's browser | Numeric validation. A spoofed value only reveals public display config |
| localStorage | Visitor-controlled | Parsed defensively. Tampering only changes that visitor's own countdown |

## Accepted risks

Documented in the README:

- A visitor can reset an evergreen timer by clearing storage. This is inherent to client-side evergreen.
- Impressions can be inflated by a determined visitor, within rate limits. Analytics are indicative, not billing-grade.
- The in-memory rate limit resets on restart and doesn't span multiple instances.

## Merchant-facing note

Evergreen timers restart for each visitor, so a merchant could present urgency that isn't real. Consumer-protection rules in some regions treat false urgency as deceptive. The README suggests using evergreen timers only for offers that genuinely end for that visitor. This is a note, not an enforced rule.
