# 02. Domain Rules

**Status:** Draft | **Implements:** FR-1, 2, 4, 7, 9, 14; NFR-9

All rules here are pure functions in `shared/`, with `now` passed as a parameter so they can be tested. Server, admin and widget share them.

## Status

Derived at read time, never stored, so no scheduled job is needed.

```
if type == evergreen      → active
if now < startAt          → scheduled
if now >= endAt           → expired
otherwise                 → active
```

- Start is inclusive and end is exclusive: a timer is live for `startAt <= now < endAt`.
- These are the PRD's three statuses, with no paused state. Stopping a timer means deleting it (gap G2), so an evergreen timer is `active` until deleted.
- An expired timer can be edited. Giving it a future end makes it scheduled or active again.

## Target matching

A timer matches a product when any of these holds:

| `targeting.scope` | Match condition |
|---|---|
| `all` | Always |
| `products` | `productIds` contains the product ID |
| `collections` | `collectionIds` intersects the product's collection IDs |

A timer has one scope. Collection membership comes from Liquid's `product.collections`, which includes only Online Store collections. A collection hidden from that channel won't match.

## Selection

`rankCandidates(timers)` returns a stable order. The widget shows the first candidate that is live.

1. **Specificity:** `products` > `collections` > `all`
2. **End time:** soonest `endAt` first. Evergreen timers have no global end, so they sort after fixed timers of the same specificity
3. **Recency:** latest `updatedAt` first
4. **Final tie-break:** `id` ascending, so the result is always deterministic

```
isLive(t, now, endedIds) = t.id not in endedIds AND (t.type == evergreen OR (t.startAt <= now AND now < t.endAt))
selectTimer(ranked, now, endedIds) = first t in ranked where isLive(t, now, endedIds), otherwise none
```

`endedIds` holds evergreen timers that reached zero for this visitor during this page view, so the widget can move to the next candidate. It starts empty on each page load. The server always passes it empty.

The server finds matching timers that are either evergreen or `endAt > now AND startAt <= now + 5 min`. It sends up to **3** in rank order: the highest-ranked live timer, if any, plus the next highest-ranked of the rest. A live timer is therefore never pushed out by timers that haven't started. The 5 minute window exceeds the longest cache life of 150 seconds, so a timer starting during a cached response still appears on time (gap G4).

## Evergreen state

Storage key: `cdt:{timerId}:{durationMinutes}`, so only a duration change restarts visitors' countdowns. Other edits, such as fixing a typo, don't. Value: `{startedAt, lastSeenAt}` as epoch milliseconds.

On page load, **restart** (`startedAt = lastSeenAt = now`) if any of these holds:

| Condition | Reason |
|---|---|
| Value missing or unparseable | First visit or corrupt data |
| `startedAt > now` | Device clock moved back |
| `now >= startedAt + duration` | Expired |
| `now - lastSeenAt > 30 min` | Session ended (decision F4) |

Otherwise, **continue**: keep `startedAt` and set `lastSeenAt = now`.

- `lastSeenAt` also refreshes every 60 seconds while the tab is visible.
- A timer reaching zero mid-view shows "Offer ended". It restarts only on the next page load, never mid-view.
- If storage is blocked, state is held in memory, so the timer restarts on each page load. This is acceptable degradation.
- Keys for the same timer with a different duration are removed when a new key is written.

## Urgency

`isUrgent(remainingMs, urgency) = urgency.mode != none AND remainingMs <= thresholdMinutes * 60000`

Default threshold is 5 minutes.

There's no separate urgency colour (gap G12):

- **`color_pulse`:** the box background fades between 100% and 70% opacity.
- **Reduced motion:** no animation. Background and text colours swap, so urgency still shows and contrast is unchanged.

## Validation

The zod schema is shared by admin and server. The server is authoritative. Unknown keys are rejected.

| Field | Rule |
|---|---|
| `name` | Required. 1-80 chars after trimming |
| `type` | `fixed` or `evergreen` |
| `startAt`, `endAt` | Fixed only: ISO 8601 UTC. `startAt < endAt`. `endAt` in the future on create, or when either date changes on update. The update case needs the stored timer, so it's a server-only check outside the shared schema. Rejected on evergreen |
| `durationMinutes` | Evergreen only: integer 1-43200 (30 days). Rejected on fixed |
| `headline` | Optional, up to 60 chars. Defaults to "Offer ends in" |
| `description` | Optional, up to 200 chars |
| `style.backgroundColor`, `style.textColor` | `^#[0-9a-fA-F]{6}$` |
| `style.size` | `small`, `medium`, `large` |
| `style.position` | `inline`, `top_bar`, `bottom_bar` |
| `urgency.mode` | `none`, `color_pulse` |
| `urgency.thresholdMinutes` | Integer ≥1, and ≤ `durationMinutes` on evergreen |
| `targeting.scope` | `all`, `products`, `collections` |
| `targeting.products`, `targeting.collections` | Required and non-empty for the matching scope, empty otherwise. Max 250. Each ID matches `^gid://shopify/(Product\|Collection)/\d+$` for its type |

**Text sanitizing** runs on `name`, `headline`, `description` and resource titles: trim, strip HTML tags, strip control characters. Output encoding is still enforced at render ([05-widget](05-widget.md#security)).

**Limit:** 200 timers per shop. Exceeding it returns 422.

## Overlap warning (FR-8b, cuttable)

`findOverlaps(timers)` flags two non-expired timers when their targets could coincide and their time windows intersect. The server computes it across all of the shop's timers, not just the current page, and returns it as `overlapsWith` on each list item. It is advisory only and never blocks a save, because selection already resolves conflicts.
