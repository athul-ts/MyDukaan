# 05. Storefront Widget

**Status:** v1.0 (Gate 2, 2026-11-05) | **Implements:** FR-2, 6, 7, 11-15; NFR-1, 2, 4, 6, 7, 9, 18

A Theme App Extension **app block** restricted to product templates (`enabled_on: {templates: ["product"]}`). The merchant places it in the theme editor. A Preact bundle renders the timer.

## Wireframe reference

Written from the PRD's wireframe, which has since been removed. The Figma link is in [PRD.md](PRD.md).

- **Data flow:** admin form (Add button, start date and time, end date and time, Save) → Node.js server with MongoDB → product detail page.
- **Product page:** image on the left; on the right, product name, subheading, price, body text and a black Add to cart button.
- **Timer:** directly below Add to cart, as a white rounded card with a soft shadow, the same width as the column. Centred text in two lines: "YOUR SPECIAL OFFER ENDS IN", then the countdown as `00:05:99`. That value is a placeholder, since 99 isn't valid seconds.

This is the default look for `inline` position.

## Zero-CLS flow

An async fetch can't avoid layout shift by itself (decision F3). So the decision about whether to reserve space is made in Liquid, before first paint, using data Shopify already has.

```
Merchant saves timer → backend writes metafield hint
                                  ↓
Product page request → block Liquid reads hint, compares with product + now
                                  ↓
        ┌─────────────────────────┼──────────────────────────┐
     no match                  match                   hint missing
     outputs nothing           box with fixed height,  fails open: loads script
     no script, no API call    loads script            and fetches; shift possible
```

| Case | Output | CLS |
|---|---|---|
| No matching timer | Nothing | 0 |
| Inline timer matches | Box with fixed height reserved before paint | 0 |
| Bar timer matches | Zero-height root element; widget moves it to `document.body` and renders `position: fixed` | 0 |
| Timer ends mid-view | "Offer ended" inside the same box | 0 |
| Hint missing, unreadable or over its size cap | Zero-height root element; script loads and fetches. A missing timer is worse for the merchant than a small shift | Possible, rare |

### Metafield hint

An app-owned JSON metafield, namespace `countdown`, key `timer_hint`, on the app installation. Liquid reads it as `app.metafields.countdown.timer_hint.value`. It needs no access scopes (confirmed in S2).

```json
{ "v": 1, "t": [
  { "s": 1764374400, "e": 1764460800, "z": "medium", "o": "inline", "a": false, "p": "|123|456|", "c": "" }
] }
```

| Key | Meaning |
|---|---|
| `s`, `e` | Start and end, epoch seconds. Both `null` on evergreen |
| `z`, `o` | Size and position |
| `a` | Scope is all products |
| `p`, `c` | Product and collection IDs, wrapped in `\|` delimiters so Liquid's `contains` can't match part of a longer ID. Searching for 123 with delimiters doesn't match 1234 |

**Built by** `buildHint(timers, now)` in `shared/`: excludes expired timers, and sorts entries in [selection order](02-domain-rules.md#selection) so the first Liquid match is the likely winner. It contains no merchant text.

**Reinstalling:** uninstalling erases this metafield, so `afterAuth` rebuilds it ([data lifecycle](03-data-model.md#data-lifecycle)).

**Size cap:** Shopify rejects a JSON metafield above 131,072 bytes. If the serialized hint exceeds 120KB, the app writes `{"v": 1, "overflow": true}` instead, and Liquid treats that as a missing hint. In S2, a 127KB hint with 34 entries added no measurable render time.

**Written on** every timer create, update and delete, and after authentication, using `metafieldsSet`. It's rebuilt from MongoDB each time, with writes queued per shop.

**On write failure:** the timer is still saved and the API returns `hintSync: "failed"`. An out-of-date hint is treated as accurate, so a new timer stays hidden on the storefront until a sync succeeds. The failure is therefore stored per shop, and the dashboard shows a warning with a **Retry** action on every load until a later sync succeeds.

### Liquid logic

```liquid
{% assign now_s = 'now' | date: '%s' | plus: 0 %}
{% comment %} For each entry: window check (now >= s - 300 and now < e, or evergreen),
   then a/p/c match against product.id and product.collections. First match wins. {% endcomment %}
```

Collection IDs are collected in a loop, because `limit` is a `for` parameter rather than a filter:

```liquid
{%- assign sorted_ids = product.collections | map: 'id' | sort -%}
{%- capture collection_ids -%}
  {%- for id in sorted_ids limit: 50 -%}{{ id }}{%- unless forloop.last -%},{%- endunless -%}{%- endfor -%}
{%- endcapture -%}
```

Output on an inline match. Bars and a missing hint use the same element with `height:0`, so the script always has a root to read from:

```html
<div id="cdt-{{ block.id }}" class="cdt-root cdt-{{ size }}" style="height:72px"
     data-product-id="{{ product.id }}"
     data-collection-ids="{{ collection_ids }}"
     data-proxy="/apps/countdown"></div>
<script src="{{ 'countdown-timer.js' | asset_url }}" defer></script>
```

The script loads through a conditional `asset_url` tag rather than the block schema's `javascript` key, so non-matching pages download nothing. Collection IDs sent to the API are capped at 50; matches beyond that are a documented limitation.

**Accepted edge case:** Liquid picks the first entry in its window, while the widget picks the first that is actually live. These can differ during the 5 minute lead-in before another timer starts. If sizes differ, the box height stays fixed and the content centres inside it. If Liquid chose a bar but the widget's choice is inline, there's no reserved box, so the timer renders as a bar. If Liquid chose inline but the widget's choice is a bar, the bar renders and the box stays empty.

## Reserved sizes

| Size | Box height | Content |
|---|---|---|
| `small` | 56px | One row: headline and countdown. No description |
| `medium` | 72px | Three rows: headline, countdown, description |
| `large` | 96px | Three rows, larger type |

The height is fixed, not a minimum. Headline and description are clamped to one line each with an ellipsis, so long text or a narrow phone can't grow the box. Hiding the description on `small` is gap G13. Final values are tuned in slice D.

## Countdown rendering

- `remaining = target - Date.now()`, recomputed each tick, so it never accumulates drift.
- `setTimeout` aligned to the next second boundary rather than a raw `setInterval`.
- Paused while the tab is hidden, recalculated on return.
- Format is `DD:HH:MM:SS`, with days omitted when zero. Tabular numerals and fixed-width digit cells keep width constant.
- Pulse animates only `opacity`, which can't shift layout. With `prefers-reduced-motion`, background and text colours swap instead ([urgency](02-domain-rules.md#urgency)).
- `role="timer"`, with `aria-live="off"` so screen readers aren't interrupted each second.

## Data flow and refresh

1. On load, make one `GET {proxy}/timers?productId=…&collectionIds=…` call.
2. Choose with `selectTimer(candidates, Date.now(), endedIds)`, and choose again whenever a candidate starts or ends.
3. There's no interval polling. `shouldRefetch` in `shared/` allows a refetch in only two cases:
   - **Tab returns:** the tab becomes visible with data older than 5 minutes.
   - **All candidates ended:** one refetch, at least 150 seconds after the last fetch so the browser cache can't return the same list. If that finds nothing live, no further refetch happens for this list.

**Known limit:** a page opened more than 5 minutes before a timer starts doesn't show that timer until it's reloaded.

## State table

| Situation | Inline | Bar |
|---|---|---|
| Fetch pending | Empty reserved box, transparent | Nothing |
| Candidates returned, none live yet | Box stays empty, countdown appears at start. No impression until then | Nothing until start |
| Cached list holds only ended timers at load | Box stays empty, as the visitor never saw the timer | Nothing |
| Live timer | Countdown | Countdown |
| Timer ends, another candidate live | Switch to it | Switch to it |
| Timer ends, none live | "Offer ended" in the box | Hide |
| Empty response | Box stays empty and transparent (rare; hint was stale) | Nothing |
| Network failure, timeout, 4xx or 5xx | Box stays empty, no console errors | Nothing |

## Failure handling

- 3 second timeout via `AbortController`. One retry after 1-3 seconds of jitter on network error or 5xx. No retry on 4xx or 429.
- The whole bundle is an IIFE with top-level try/catch and a Preact error boundary. It defines no globals, and catches all errors silently.
- `localStorage` access is always wrapped ([evergreen](02-domain-rules.md#evergreen-state)).
- Multiple blocks on one page each mount independently, and the script is guarded against double execution.

## Impressions

- `IntersectionObserver` at 50% visibility, once per timer per page view.
- Sent with `navigator.sendBeacon`, falling back to `fetch` with `keepalive`.
- Fire-and-forget. Failure is ignored.
- If `IntersectionObserver` isn't available, no impression is sent.
- Each distinct timer counts once per page view, when it's live and visible. If the widget switches to another candidate mid-view, that timer gets its own count. The "Offer ended" state doesn't count.

## Styling

- All classes are prefixed `cdt-`, with no resets or global selectors.
- Themes such as Horizon shrink the block wrapper to its content, so `width:100%` on the root alone collapses the box and lets its width follow the digits. `:has(>.cdt-root)` makes that one parent fill the column. It is the only rule that touches a theme element. If a browser or theme ignores it, the box is narrower but the page stays intact. Don't give the root a large intrinsic width such as `100vw`: it stretches the wrapper and makes the whole page scroll sideways, as seen on the dev store.
- A theme ancestor can create a stacking context that traps a bar's `z-index`, as seen on the dev store, where the header and page images painted over the bar. So a bar's root moves to `document.body` before paint, leaving a spacer of the same height in its place so a reserved box never collapses. The move reverses if the widget later switches to an inline timer. While moved, the root loses the `cdt-root` class, so the `:has(>.cdt-root)` rule can't match `body`, and takes `display: contents`, so it can't add a gap in a flex or grid `body`. The theme editor gets the same move, so its preview matches the store. When the editor unloads the section (`shopify:section:unload`), the moved root is unmounted and removed, so a reload can't leave a duplicate bar.
- A bar covers whatever is under it, because pushing the page down would be a layout shift.
- Size CSS is inlined in the block so the reservation applies before external CSS loads.
- Colours are set through CSS custom properties from the validated hex values.
- Shadow DOM isn't used: prefixed classes are enough here, and it adds complexity with little benefit.

## Security

- Merchant text renders only as Preact text nodes. `dangerouslySetInnerHTML` is forbidden, and lint rejects it.
- Liquid outputs only numeric IDs and enumerated size and position values, never merchant text.
- Colours reach style properties only after hex validation on both write and render.

## Build

`esbuild` bundles `widget/src/index.jsx` with Preact into a minified IIFE at `extensions/countdown-timer/assets/countdown-timer.js`. The extension also needs a `locales/` folder, or `shopify app dev` logs errors. `npm run check:size` fails above 30KB gzipped, reports against the 15KB target, and notes Shopify's 10KB advisory. The widget imports only status, selection and evergreen functions from `shared/`, never zod.

## Theme editor

Merchants need to see that a block they just added is working, even on a product no timer targets. When `request.design_mode` is true and no timer matches, Liquid outputs a short fixed note in place of nothing. Shoppers never see it, and it contains no merchant text. The widget also remounts on `shopify:section:load`, only in the editor, because the editor replaces section HTML without re-running scripts.

## Root element

The script reads these from the root that Liquid outputs:

| Attribute | Meaning |
|---|---|
| `data-reserved` | Height reserved in pixels, `0` for a bar or a missing hint |
| `data-hint-missing` | Present when the hint is missing, unreadable or over its cap. An inline timer may then expand the box, which is the accepted rare shift |
| `data-bar` | The bar Liquid chose. An inline timer with no reserved box and a readable hint renders as this bar, so it can't cause a shift |

## Changelog

- 2026-11-05: Slice D. Added the theme editor note and remount, and the root attributes that separate a missing hint from a chosen bar. The theme editor link gains `target=mainSection`. Decisions F5, G5, G6, G10, G11, G12 and G13 confirmed.
- 2026-11-05: Root width changed after the dev store showed a collapsed box on Horizon, then changed again because the first fix caused sideways scrolling.
- 2026-11-05: Bars move to `document.body` before paint, after the dev store showed theme content painting over them. The theme editor gets the same move, with clean-up on section unload.
