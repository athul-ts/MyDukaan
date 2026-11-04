# 06. Admin App

**Status:** Approved (Gate 1, 2026-11-05) | **Implements:** FR-5, 6, 8, 9, 10, 18; NFR-17

React and Vite from the template, embedded with App Bridge. Screens use **Polaris web components** loaded by CDN (`polaris-2.js`, `app-bridge.js`). `@shopify/polaris` is removed, and the template's sample pages are deleted. **[S4]** confirms how `s-*` elements behave under React 18.

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
- **Loading:** skeleton
- **Empty:** explains timers and links to create one
- **Error:** banner with retry
- **Hint sync failed:** warning banner with a **Retry** action, shown on every load while the list reports `hintSync: "failed"`. It explains that storefront timers may be out of date
- **Paged:** 20 per page

**Cuttable:** search and status filter and sort (FR-8a), overlap warning (FR-8b), theme editor link (FR-18). The link format is `shopify://admin/themes/current/editor?template=product&addAppBlockId={api_key}/{block_handle}`, confirmed in S2.

## Form

**A modal, as in the mockup** (user decision), using `s-modal`. Create and edit share it, titled "Create New Timer" or "Edit timer", with Cancel and a primary button in the footer. The form is longer than the mockup because it adds type and targeting, so the modal body scrolls.

**[S4]** checks that the resource picker opens above the modal. If it doesn't, the modal closes while the picker is open and reopens with the selection, keeping all form values in React state.

| Section | Fields | Component |
|---|---|---|
| Basics | Name, Headline, Promotion description | `s-text-field`, `s-text-area` |
| Type | Fixed or Evergreen; switching shows the relevant fields | `s-choice-list` |
| Schedule (fixed) | Start date and time, End date and time | `s-date-field`; time input per **[S4]** |
| Schedule (evergreen) | Duration, with minutes or hours unit | `s-number-field` |
| Targeting | All, Products or Collections; a picker button and a removable selected list | `s-choice-list`, `shopify.resourcePicker` |
| Appearance | Background colour, Text colour, Size, Position | `s-color-field`, `s-select` |
| Urgency | Urgency notification: None or Colour pulse; threshold in minutes | `s-select`, `s-number-field` |
| Preview | Static preview of colours, text and size, which hides the description on `small` | Plain HTML |

Component names are from Shopify's index and **[S4]** verifies each. Polaris web components are authored as custom elements; if React 18 can't pass props or events properly, the fallback is thin wrapper components.

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

The shared zod schema runs on submit and on field blur. Errors appear inline, and a summary banner appears on submit. Server `422` details map onto fields by `path`, so server-only failures show the same way. Save is disabled while in flight, and a failed save keeps form contents.

### Timezone

1. `GET /api/shop` supplies `ianaTimezone`.
2. Date and time inputs are wall-clock in that timezone, with the zone name shown beside them. This means every staff member sees the same schedule, regardless of their location.
3. `date-fns-tz` converts to UTC on submit and back on load, which handles daylight saving correctly.
4. The API exchanges UTC ISO 8601 only.
5. If `GET /api/shop` fails, the form shows an error with retry and blocks saving fixed timers, so a schedule is never saved in the wrong timezone. Evergreen timers can still be saved. It never falls back to the browser's timezone. The dashboard shows fixed schedules in UTC, labelled as such, until the timezone loads.

## Calling the API

Using the template's authenticated fetch, which attaches the session token. A small API client unwraps the [error shape](04-api.md#errors). A 401 follows App Bridge's re-auth flow. **[S4]** confirms how both of these work with the CDN App Bridge script. Mutations refetch the list.

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
