import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
import {
  DEFAULT_HEADLINE,
  endMustBeInFuture,
  timerInputSchema,
} from "../../shared/validation.js";

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
export const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

const pad = (number) => String(number).padStart(2, "0");

/**
 * The time picker's columns. A typed "13:30" opens as 1, 30, PM. With no valid time typed, it
 * opens at the working day's start, 9:00 AM.
 */
export function toClock(value) {
  if (!TIME_PATTERN.test(value)) return { hour: 9, minute: 0, period: "AM" };
  const [hours, minute] = value.split(":").map(Number);
  return { hour: hours % 12 || 12, minute, period: hours < 12 ? "AM" : "PM" };
}

/** Back to the form's HH:mm. 12 AM is midnight and 12 PM is noon. */
export function fromClock({ hour, minute, period }) {
  const hours = (hour % 12) + (period === "PM" ? 12 : 0);
  return `${pad(hours)}:${pad(minute)}`;
}

export function emptyForm() {
  return {
    name: "",
    headline: DEFAULT_HEADLINE,
    description: "",
    type: "fixed",
    startDate: "",
    startTime: "",
    endDate: "",
    endTime: "",
    durationValue: "1",
    durationUnit: "hours",
    scope: "all",
    products: [],
    collections: [],
    backgroundColor: "#111111",
    textColor: "#FFFFFF",
    size: "medium",
    position: "inline",
    urgencyMode: "color_pulse",
    threshold: "5",
  };
}

/** Shows an evergreen duration in hours when it's a whole number of them. */
function durationFields(minutes) {
  if (!minutes) return { durationValue: "1", durationUnit: "hours" };
  return minutes % 60 === 0
    ? { durationValue: String(minutes / 60), durationUnit: "hours" }
    : { durationValue: String(minutes), durationUnit: "minutes" };
}

function zonedFields(iso, timeZone, dateKey, timeKey) {
  if (!iso || !timeZone) return { [dateKey]: "", [timeKey]: "" };
  return {
    [dateKey]: formatInTimeZone(iso, timeZone, "yyyy-MM-dd"),
    [timeKey]: formatInTimeZone(iso, timeZone, "HH:mm"),
  };
}

export function formFromTimer(timer, timeZone) {
  return {
    name: timer.name,
    headline: timer.headline,
    description: timer.description,
    type: timer.type,
    ...zonedFields(timer.startAt, timeZone, "startDate", "startTime"),
    ...zonedFields(timer.endAt, timeZone, "endDate", "endTime"),
    ...durationFields(timer.durationMinutes),
    scope: timer.targeting.scope,
    products: timer.targeting.products,
    collections: timer.targeting.collections,
    backgroundColor: timer.style.backgroundColor,
    textColor: timer.style.textColor,
    size: timer.style.size,
    position: timer.style.position,
    urgencyMode: timer.urgency.mode,
    threshold: String(timer.urgency.thresholdMinutes),
  };
}

/** The wall clock in the shop's timezone becomes UTC here, which handles daylight saving. */
function toUtc(date, time, timeZone) {
  if (!timeZone || !DATE_PATTERN.test(date) || !TIME_PATTERN.test(time)) return undefined;
  return fromZonedTime(`${date}T${time}:00`, timeZone).toISOString();
}

const toInteger = (value) => (/^\d+$/.test(String(value).trim()) ? Number(value) : undefined);

export function formToPayload(form, timeZone) {
  const payload = {
    name: form.name,
    type: form.type,
    headline: form.headline,
    description: form.description,
    style: {
      backgroundColor: form.backgroundColor,
      textColor: form.textColor,
      size: form.size,
      position: form.position,
    },
    urgency: { mode: form.urgencyMode, thresholdMinutes: toInteger(form.threshold) },
    targeting: {
      scope: form.scope,
      products: form.scope === "products" ? form.products : [],
      collections: form.scope === "collections" ? form.collections : [],
    },
  };
  if (form.type === "fixed") {
    payload.startAt = toUtc(form.startDate, form.startTime, timeZone);
    payload.endAt = toUtc(form.endDate, form.endTime, timeZone);
  } else {
    const value = toInteger(form.durationValue);
    payload.durationMinutes =
      value === undefined ? undefined : form.durationUnit === "hours" ? value * 60 : value;
  }
  return payload;
}

const FIELD_FOR_PATH = {
  name: "name",
  headline: "headline",
  description: "description",
  type: "type",
  startAt: "startDate",
  endAt: "endDate",
  durationMinutes: "durationValue",
  "style.backgroundColor": "backgroundColor",
  "style.textColor": "textColor",
  "style.size": "size",
  "style.position": "position",
  "urgency.mode": "urgencyMode",
  "urgency.thresholdMinutes": "threshold",
  "targeting.scope": "scope",
  "targeting.products": "targeting",
  "targeting.collections": "targeting",
};

/** Maps API or schema error paths onto form fields, so both show the same way. */
export function errorsFromDetails(details = []) {
  const errors = {};
  for (const { path, message } of details) {
    const key = Object.keys(FIELD_FOR_PATH).find((prefix) => path === prefix || path.startsWith(`${prefix}.`));
    const field = key ? FIELD_FOR_PATH[key] : "form";
    errors[field] ??= message;
  }
  return errors;
}

/** Runs the rules the server also enforces. The server remains the authority. */
export function validateForm(form, timeZone, { existing = null, now = Date.now() } = {}) {
  const payload = formToPayload(form, timeZone);
  const result = timerInputSchema.safeParse(payload);
  const errors = result.success
    ? {}
    : errorsFromDetails(
        result.error.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message })),
      );

  if (form.type === "fixed") {
    if (!timeZone) errors.form = "The store's timezone hasn't loaded, so this schedule can't be saved.";
    for (const [dateKey, timeKey, label] of [
      ["startDate", "startTime", "Start"],
      ["endDate", "endTime", "End"],
    ]) {
      if (!DATE_PATTERN.test(form[dateKey])) errors[dateKey] = `${label} date is required`;
      else delete errors[dateKey];
      if (!TIME_PATTERN.test(form[timeKey])) errors[timeKey] = "Enter a time as HH:mm, like 09:30";
    }
    if (result.success && endMustBeInFuture(payload, existing) && new Date(payload.endAt).getTime() <= now) {
      // The merchant's own clock may be on another day, so say what time it is for the store.
      const storeNow = formatInTimeZone(now, timeZone, "h:mm a 'on' MMM d");
      errors.endDate = `Must be in the future. It's ${storeNow} in the store's timezone.`;
    }
    if (
      payload.startAt &&
      payload.endAt &&
      new Date(payload.startAt).getTime() >= new Date(payload.endAt).getTime()
    ) {
      errors.endDate = "Must be after start";
    }
  } else if (toInteger(form.durationValue) === undefined) {
    errors.durationValue = "Enter a whole number";
  }
  if (toInteger(form.threshold) === undefined) errors.threshold = "Enter a whole number of minutes";

  return { payload, errors, valid: Object.keys(errors).length === 0 };
}

/**
 * The first day the end date's calendar offers: the start date or today in the store's timezone,
 * whichever is later. Undefined when neither is known, which leaves every day open.
 */
export function earliestEndDate(form, timeZone, now = Date.now()) {
  const today = timeZone ? formatInTimeZone(now, timeZone, "yyyy-MM-dd") : "";
  const start = DATE_PATTERN.test(form.startDate) ? form.startDate : "";
  return (start > today ? start : today) || undefined;
}

const SCHEDULE_FIELDS = new Set(["startDate", "startTime", "endDate", "endTime"]);

/** Both dates and both times are filled in validly, so the schedule's order can be checked. */
export function scheduleComplete(form) {
  return (
    DATE_PATTERN.test(form.startDate) &&
    TIME_PATTERN.test(form.startTime) &&
    DATE_PATTERN.test(form.endDate) &&
    TIME_PATTERN.test(form.endTime)
  );
}

/**
 * The errors to show after one field changes. After a save attempt, everything is re-checked.
 * Before that, a field shows its own error once it has been left, and a complete schedule is
 * checked straight away, so an end before the start shows at once and clears once fixed.
 */
export function errorsAfterChange(previous, field, next, { touched, submitted, timeZone, existing, now }) {
  const found = validateForm(next, timeZone, { existing, now }).errors;
  if (submitted) return found;
  const updated = { ...previous };
  if (touched[field]) updated[field] = found[field];
  if (next.type === "fixed" && SCHEDULE_FIELDS.has(field) && scheduleComplete(next)) {
    updated.endDate = found.endDate;
  }
  return updated;
}

export function formatSchedule(timer, timeZone) {
  if (timer.type === "evergreen") {
    const { durationValue, durationUnit } = durationFields(timer.durationMinutes);
    const unit = durationUnit === "hours" ? "hr" : "min";
    return `${durationValue} ${unit} per visitor`;
  }
  const zone = timeZone || "UTC";
  const format = (iso) => formatInTimeZone(iso, zone, "MMM d, yyyy, h:mm a");
  const label = timeZone ? formatInTimeZone(timer.endAt, zone, "zzz") : "UTC";
  return `${format(timer.startAt)} to ${format(timer.endAt)} ${label}`;
}

export function formatTargeting({ scope, products, collections }) {
  const count = (list, noun) => `${list.length} ${noun}${list.length === 1 ? "" : "s"}`;
  if (scope === "products") return count(products, "product");
  if (scope === "collections") return count(collections, "collection");
  return "All products";
}
