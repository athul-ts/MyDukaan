import { describe, expect, it } from "vitest";
import {
  emptyForm,
  errorsFromDetails,
  formatSchedule,
  formatTargeting,
  formFromTimer,
  formToPayload,
  fromClock,
  toClock,
  validateForm,
} from "../../web/frontend/timerForm.js";
import { timerInputSchema } from "../../shared/validation.js";

const NEW_YORK = "America/New_York";
const NOW = Date.parse("2030-01-01T00:00:00.000Z");

const fixedForm = (overrides = {}) => ({
  ...emptyForm(),
  name: "Black Friday",
  startDate: "2030-11-29",
  startTime: "09:00",
  endDate: "2030-11-30",
  endTime: "17:30",
  ...overrides,
});
const evergreenForm = (overrides = {}) => ({
  ...emptyForm(),
  name: "Always on",
  type: "evergreen",
  ...overrides,
});
const validate = (form, options = {}) => validateForm(form, NEW_YORK, { now: NOW, ...options });

describe("shop timezone conversion (G3, M-15)", () => {
  it("treats entered times as the shop's wall clock, not the browser's", () => {
    const { startAt } = formToPayload(fixedForm(), NEW_YORK);
    expect(startAt).toBe("2030-11-29T14:00:00.000Z");
    const { startAt: kolkata } = formToPayload(fixedForm(), "Asia/Kolkata");
    expect(kolkata).toBe("2030-11-29T03:30:00.000Z");
  });

  it("applies daylight saving for the date entered", () => {
    const winter = formToPayload(fixedForm({ startDate: "2030-01-15" }), NEW_YORK);
    const summer = formToPayload(fixedForm({ startDate: "2030-07-15" }), NEW_YORK);
    expect(winter.startAt).toBe("2030-01-15T14:00:00.000Z");
    expect(summer.startAt).toBe("2030-07-15T13:00:00.000Z");
  });

  it("shows the same wall clock when reopened", () => {
    const payload = formToPayload(fixedForm(), NEW_YORK);
    const form = formFromTimer(
      { ...payload, durationMinutes: null, targeting: payload.targeting, urgency: payload.urgency, style: payload.style },
      NEW_YORK,
    );
    expect([form.startDate, form.startTime, form.endDate, form.endTime]).toEqual([
      "2030-11-29",
      "09:00",
      "2030-11-30",
      "17:30",
    ]);
  });

  it("never falls back to the browser's timezone when the shop's is missing", () => {
    const { startAt, endAt } = formToPayload(fixedForm(), null);
    expect(startAt).toBeUndefined();
    expect(endAt).toBeUndefined();
    const { valid, errors } = validateForm(fixedForm(), null, { now: NOW });
    expect(valid).toBe(false);
    expect(errors.form).toMatch(/timezone/);
  });

  it("still allows saving an evergreen timer without the timezone", () => {
    expect(validateForm(evergreenForm(), null, { now: NOW }).valid).toBe(true);
  });
});

describe("validateForm", () => {
  it("accepts a complete form, producing a payload the API schema accepts", () => {
    for (const form of [fixedForm(), evergreenForm()]) {
      const { valid, payload, errors } = validate(form);
      expect(errors).toEqual({});
      expect(valid).toBe(true);
      expect(timerInputSchema.safeParse(payload).success).toBe(true);
    }
  });

  it("requires a name", () => {
    expect(validate(fixedForm({ name: "  " })).errors.name).toBeDefined();
  });

  it("requires dates, and a time in HH:mm", () => {
    const { errors } = validate(fixedForm({ startDate: "", endTime: "5pm" }));
    expect(errors.startDate).toMatch(/required/);
    expect(errors.endTime).toMatch(/HH:mm/);
    expect(validate(fixedForm({ startTime: "24:00" })).errors.startTime).toBeDefined();
  });

  it("requires the end to be after the start", () => {
    const { errors } = validate(fixedForm({ endDate: "2030-11-29", endTime: "09:00" }));
    expect(errors.endDate).toBe("Must be after start");
  });

  it("requires a future end on create", () => {
    const form = fixedForm({ startDate: "2029-01-01", endDate: "2029-01-02" });
    expect(validate(form).errors.endDate).toBe("Must be in the future");
  });

  it("lets an expired timer be edited as long as its dates don't change", () => {
    const form = fixedForm({ startDate: "2029-01-01", endDate: "2029-01-02" });
    const { startAt, endAt } = formToPayload(form, NEW_YORK);
    const existing = { type: "fixed", startAt, endAt };
    expect(validate(form, { existing }).valid).toBe(true);
    expect(validate({ ...form, endTime: "18:00" }, { existing }).errors.endDate).toBe("Must be in the future");
  });

  it("requires a whole number for duration and threshold", () => {
    expect(validate(evergreenForm({ durationValue: "" })).errors.durationValue).toBeDefined();
    expect(validate(evergreenForm({ durationValue: "1.5" })).errors.durationValue).toBeDefined();
    expect(validate(fixedForm({ threshold: "" })).errors.threshold).toBeDefined();
  });

  it("converts hours to minutes", () => {
    expect(validate(evergreenForm({ durationValue: "2", durationUnit: "hours" })).payload.durationMinutes).toBe(120);
    expect(validate(evergreenForm({ durationValue: "45", durationUnit: "minutes" })).payload.durationMinutes).toBe(45);
  });

  it("rejects a threshold longer than an evergreen duration", () => {
    const form = evergreenForm({ durationValue: "10", durationUnit: "minutes", threshold: "11" });
    expect(validate(form).errors.threshold).toBeDefined();
  });

  it("requires a selection for a specific scope", () => {
    expect(validate(fixedForm({ scope: "products" })).errors.targeting).toBeDefined();
    const products = [{ id: "gid://shopify/Product/1", title: "Pot" }];
    expect(validate(fixedForm({ scope: "products", products })).valid).toBe(true);
  });

  it("only sends the list for the chosen scope, keeping products and collections apart", () => {
    const products = [{ id: "gid://shopify/Product/1", title: "Pot" }];
    const collections = [{ id: "gid://shopify/Collection/2", title: "Sale" }];
    const { targeting } = formToPayload(fixedForm({ scope: "collections", products, collections }), NEW_YORK);
    expect(targeting.products).toEqual([]);
    expect(targeting.collections).toEqual(collections);
  });

  it("rejects an invalid colour", () => {
    expect(validate(fixedForm({ backgroundColor: "" })).errors.backgroundColor).toBeDefined();
  });
});

describe("errorsFromDetails (server errors show like client errors)", () => {
  it("maps API paths onto form fields", () => {
    expect(
      errorsFromDetails([
        { path: "endAt", message: "Must be in the future" },
        { path: "urgency.thresholdMinutes", message: "Too long" },
        { path: "targeting.products.0.id", message: "Bad ID" },
        { path: "style.textColor", message: "Bad colour" },
      ]),
    ).toEqual({
      endDate: "Must be in the future",
      threshold: "Too long",
      targeting: "Bad ID",
      textColor: "Bad colour",
    });
  });

  it("puts errors with no field on the form", () => {
    expect(errorsFromDetails([{ path: "", message: "Timer limit" }])).toEqual({ form: "Timer limit" });
  });
});

describe("display helpers", () => {
  const timer = {
    type: "fixed",
    startAt: "2030-11-29T14:00:00.000Z",
    endAt: "2030-11-30T22:30:00.000Z",
  };

  it("shows the schedule in the shop's timezone", () => {
    expect(formatSchedule(timer, NEW_YORK)).toBe("Nov 29, 2030, 9:00 AM to Nov 30, 2030, 5:30 PM EST");
  });

  it("labels the schedule UTC when the timezone is missing", () => {
    expect(formatSchedule(timer, null)).toBe("Nov 29, 2030, 2:00 PM to Nov 30, 2030, 10:30 PM UTC");
  });

  it("describes evergreen durations", () => {
    expect(formatSchedule({ type: "evergreen", durationMinutes: 45 }, NEW_YORK)).toBe("45 min per visitor");
    expect(formatSchedule({ type: "evergreen", durationMinutes: 120 }, NEW_YORK)).toBe("2 hr per visitor");
  });

  it("summarises targeting", () => {
    const base = { products: [], collections: [] };
    expect(formatTargeting({ ...base, scope: "all" })).toBe("All products");
    expect(formatTargeting({ ...base, scope: "products", products: [1, 2, 3] })).toBe("3 products");
    expect(formatTargeting({ ...base, scope: "collections", collections: [1] })).toBe("1 collection");
  });
});

describe("time picker conversion", () => {
  it("opens a typed time in the right columns", () => {
    expect(toClock("13:30")).toEqual({ hour: 1, minute: 30, period: "PM" });
    expect(toClock("09:07")).toEqual({ hour: 9, minute: 7, period: "AM" });
    expect(toClock("00:00")).toEqual({ hour: 12, minute: 0, period: "AM" });
    expect(toClock("12:15")).toEqual({ hour: 12, minute: 15, period: "PM" });
    expect(toClock("23:59")).toEqual({ hour: 11, minute: 59, period: "PM" });
  });

  it("opens at 9:00 AM when no valid time is typed", () => {
    expect(toClock("")).toEqual({ hour: 9, minute: 0, period: "AM" });
    expect(toClock("9am")).toEqual({ hour: 9, minute: 0, period: "AM" });
    expect(toClock("24:00")).toEqual({ hour: 9, minute: 0, period: "AM" });
  });

  it("turns the columns back into HH:mm, with 12 AM as midnight and 12 PM as noon", () => {
    expect(fromClock({ hour: 1, minute: 30, period: "PM" })).toBe("13:30");
    expect(fromClock({ hour: 12, minute: 0, period: "AM" })).toBe("00:00");
    expect(fromClock({ hour: 12, minute: 5, period: "PM" })).toBe("12:05");
    expect(fromClock({ hour: 9, minute: 7, period: "AM" })).toBe("09:07");
  });

  it("round-trips every minute of the day", () => {
    for (let minutes = 0; minutes < 24 * 60; minutes++) {
      const value = `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
      expect(fromClock(toClock(value))).toBe(value);
    }
  });
});
