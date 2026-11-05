# 06. Admin App

**Status:** v1.0 (Gate 2, 2026-11-05) | **Implements:** FR-5, 6, 8, 9, 10, 18; NFR-17

React and Vite from the template, embedded with App Bridge. Screens use **Polaris web components** loaded by CDN (`polaris-2.js`, `app-bridge.js`). `@shopify/polaris` is removed, and the template's sample pages are deleted. S4 confirmed `s-*` elements work under React 18.

## Routes

| Route | Screen |
|---|---|
| `/` | Dashboard. Create and edit open in a modal over it, so the app has one route |

## Dashboard

Layout follows the mockup's "Countdown Timer Manager" with a **Create timer** primary action.

| Column | Content |
|---|---|
| Name | Timer name and description excerpt |
| Status | Badge: active, scheduled, expired |
| Type | Fixed or Evergreen |
| Targeting | "All products", "3 products", "2 collections" |
| Schedule | Start-end in the shop's timezone, or "45 min per visitor" |
| Impressions | Total |
| Actions | "⋯" menu: Edit, Delete. The delete confirmation warns that the impression count is lost too |

**States:**
- **Loading:** spinner
- **Empty:** explains timers and links to create one
- **Error:** banner with retry
- **Hint sync failed:** warning banner with a **Retry** action, shown on every load while the list reports `hintSync: "failed"`. It explains that storefront timers may be out of date
- **Paged:** 20 per page

**Cuttable:** search and status filter and sort (FR-8a), overlap warning (FR-8b), theme editor link (FR-18). The link format is `shopify://admin/themes/current/editor?template=product&addAppBlockId={api_key}/{block_handle}&target=mainSection`, confirmed in S2.

## Form

**A modal, as in the mockup** (user decision), using `s-modal`. Create and edit share it, titled "Create New Timer" or "Edit timer", with Cancel and a primary button in the footer. The form is longer than the mockup because it adds type and targeting, so the modal body scrolls.

The resource picker opens above the modal (confirmed in S4), so no workaround is needed.

| Section | Fields | Component |
|---|---|---|
| Basics | Name, Headline, Promotion description | `s-text-field`, `s-text-area` |
| Type | Fixed or Evergreen; switching shows the relevant fields | `s-choice-list` |
| Schedule (fixed) | Start date and time, End date and time | `s-date-field`, and a time field built the way Polaris builds its colour field, as no time component exists (S4): an `s-text-field` with a clock icon and HH:mm validation, so any minute can be typed, plus a button in its `accessory` slot that opens an `s-popover`. The popover has scrolling hour (1-12), minute (00-59) and AM/PM columns, opening on the current value or 9:00 AM, with Cancel and OK. Only OK changes the field. Escape closes the popover but not the modal. No seconds, as schedules are to the minute |
| Schedule (evergreen) | Duration, with minutes or hours unit | `s-number-field` |
| Targeting | All, Products or Collections; a picker button and a removable selected list | `s-choice-list`, `shopify.resourcePicker` |
| Appearance | Background colour, Text colour, Size, Position | `s-color-field`, `s-select` |
| Urgency | Urgency notification: None or Colour pulse; threshold in minutes | `s-select`, `s-number-field` |
| Preview | Static preview of colours, text and size, which hides the description on `small` | Plain HTML |

S4 verified these components. Under React 18, a thin wrapper passes values as props and listens for `input` and `change` on a `ref`. `s-choice-list` reports through `values`, not `value`. Loading states use `s-spinner`, as `s-skeleton-paragraph` doesn't exist. Keep product and collection selections separate, because passing the wrong type in `selectionIds` makes the picker fail.

### Resource picker

```js
const selected = await shopify.resourcePicker({
  type: 'product',          // or 'collection'
  multiple: 250,
  selectionIds: current.map((r) => ({ id: r.id })),
});
if (selected) { /* store id and title; undefined means cancelled, so keep the current list */ }
```

### Validation UX

The shared zod schema runs on submit and on field blur. Errors appear inline, and a summary banner appears on submit.

The schedule is checked as soon as it can be. The end date's calendar only offers dates from the start date or today in the shop's timezone, whichever is later (`allow` on `s-date-field`). An end in the past says what time it is for the shop, such as "Must be in the future. It's 5:24 PM on Nov 5 in the store's timezone", because the merchant's own clock may be on a different day. Once both dates and both times are filled in, any change to one of them re-checks the end straight away, so an end at or before the start shows "Must be after start" without waiting for blur or submit, and fixing either side clears it. Server `422` details map onto fields by `path`, so server-only failures show the same way. Save is disabled while in flight, and a failed save keeps form contents.

### Timezone

1. `GET /api/shop` supplies `ianaTimezone`.
2. Date and time inputs are wall-clock in that timezone, with the zone name shown beside them. This means every staff member sees the same schedule, regardless of their location.
3. `date-fns-tz` converts to UTC on submit and back on load, which handles daylight saving correctly.
4. The API exchanges UTC ISO 8601 only.
5. If `GET /api/shop` fails, the form shows an error with retry and blocks saving fixed timers, so a schedule is never saved in the wrong timezone. Evergreen timers can still be saved. It never falls back to the browser's timezone. The dashboard shows fixed schedules in UTC, labelled as such, until the timezone loads.

## Calling the API

Using the global `fetch`, which the CDN App Bridge script patches to attach the session token (confirmed in S4). A small API client unwraps the [error shape](04-api.md#errors). A 401 follows App Bridge's re-auth flow. Mutations refetch the list.

## Mockup reference

Written from the PRD's admin screenshot, which has since been removed. The original is on the Notion page linked at the top of [PRD.md](PRD.md).

**List page, "Countdown Timer Manager":**
- Subtitle: "Create and manage countdown timers for your promotions"
- **Create timer** primary button with a plus icon, top right
- One card holding a "Search timers" field, a dashed "+" filter button, and a sort dropdown with a "date (oldest first)" option
- Rows separated by dividers. Each row shows the bold timer name, the description, and "Start: 2024-11-29 00:00", with a "⋯" action menu at the far right
- Sample rows: Black Friday Sale ("50% off all products"), Flash Sale ("Limited time offer"), Summer Sale

The screenshot's modal hides the right side of each row, so any further columns aren't known.

**Form, modal titled "Create New Timer", top to bottom:**

| Field | Control | Placeholder or sample |
|---|---|---|
| Timer name (required, red asterisk) | Text | "Enter timer name" |
| Start date, Start time | Two inputs, side by side | mm/dd/yyyy, --:-- -- |
| End date, End time | Two inputs, side by side | mm/dd/yyyy, --:-- -- |
| Promotion description | Multi-line text | "Enter promotion details" |
| Colour | Saturation square with a vertical hue slider | Green selected |
| Timer size, Timer position | Two dropdowns, side by side | Medium, Top |
| Urgency notification | Dropdown, full width | Color pulse |

Footer: **Cancel** and a dark primary **Create timer**, aligned right. The look is standard Polaris: white cards, grey header band on the modal, rounded corners.

## Divergences from the mockup

| Mockup | Spec | Reason |
|---|---|---|
| One colour picker | Background and text | PRD §3 says "colors"; needed for contrast |
| No type or targeting | Added | PRD §4.1, §4.2 |
| Position: Top | Inline, Top bar, Bottom bar | Decision F2 |

## Changelog

- 2026-11-06: Start and end time gain a picker in a popover, with hour, minute and AM/PM columns and Cancel and OK, beside the typed HH:mm field, following a reference design from the user.
- 2026-11-06: The end date calendar starts at the start date, and an end at or before the start is flagged as soon as the schedule is complete, at the user's request.
- 2026-11-06: The end date calendar also starts no earlier than today in the shop's timezone, and "Must be in the future" names the shop's current time, after the user hit it while in a different timezone from the shop.
