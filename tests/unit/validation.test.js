import { describe, expect, it } from "vitest";
import {
  DEFAULT_HEADLINE,
  endMustBeInFuture,
  sanitizeText,
  timerInputSchema,
} from "../../shared/validation.js";

export const validFixed = () => ({
  name: "Black Friday",
  type: "fixed",
  startAt: "2030-11-29T00:00:00.000Z",
  endAt: "2030-11-30T00:00:00.000Z",
  headline: "Ends soon",
  description: "50% off",
  style: { backgroundColor: "#111111", textColor: "#FFFFFF", size: "medium", position: "inline" },
  urgency: { mode: "color_pulse", thresholdMinutes: 5 },
  targeting: { scope: "all", products: [], collections: [] },
});
const validEvergreen = () => {
  const { startAt: _s, endAt: _e, ...rest } = validFixed();
  return { ...rest, type: "evergreen", durationMinutes: 45 };
};
const productTargeting = {
  scope: "products",
  products: [{ id: "gid://shopify/Product/123", title: "Pot" }],
  collections: [],
};

const parse = (input) => timerInputSchema.safeParse(input);
const paths = (result) => result.error.issues.map((item) => item.path.join("."));

describe("T-4 valid input", () => {
  it("accepts a fixed timer and an evergreen timer", () => {
    expect(parse(validFixed()).success).toBe(true);
    expect(parse(validEvergreen()).success).toBe(true);
  });

  it("applies the default headline and an empty description", () => {
    const { headline: _h, description: _d, ...rest } = validFixed();
    const { data } = parse(rest);
    expect(data.headline).toBe(DEFAULT_HEADLINE);
    expect(data.description).toBe("");
  });
});

describe("T-4 dates and types", () => {
  it("rejects a start that isn't before the end", () => {
    const same = parse({ ...validFixed(), endAt: validFixed().startAt });
    expect(paths(same)).toContain("endAt");
  });

  it("rejects dates on evergreen, and duration on fixed", () => {
    expect(paths(parse({ ...validEvergreen(), startAt: validFixed().startAt }))).toContain("startAt");
    expect(paths(parse({ ...validFixed(), durationMinutes: 10 }))).toContain("durationMinutes");
  });

  it("requires the fields for each type", () => {
    const { endAt: _e, ...noEnd } = validFixed();
    expect(paths(parse(noEnd))).toContain("endAt");
    const { durationMinutes: _d, ...noDuration } = validEvergreen();
    expect(paths(parse(noDuration))).toContain("durationMinutes");
  });

  it("only accepts UTC timestamps", () => {
    expect(parse({ ...validFixed(), endAt: "2030-11-30T00:00:00+05:30" }).success).toBe(false);
    expect(parse({ ...validFixed(), endAt: "tomorrow" }).success).toBe(false);
  });

  it("limits duration to 30 days, and threshold to the duration on evergreen", () => {
    expect(parse({ ...validEvergreen(), durationMinutes: 43201 }).success).toBe(false);
    expect(parse({ ...validEvergreen(), durationMinutes: 0 }).success).toBe(false);
    const longThreshold = { ...validEvergreen(), urgency: { mode: "color_pulse", thresholdMinutes: 46 } };
    expect(paths(parse(longThreshold))).toContain("urgency.thresholdMinutes");
  });
});

describe("T-4 colours, IDs and targeting", () => {
  it("rejects anything but a six digit hex colour", () => {
    for (const backgroundColor of ["red", "#FFF", "#GGGGGG", "url(x)", "#111111;color:red"]) {
      const input = { ...validFixed(), style: { ...validFixed().style, backgroundColor } };
      expect(parse(input).success).toBe(false);
    }
  });

  it("rejects bad GIDs, and a GID of the wrong type", () => {
    const withProduct = (id) => ({
      ...validFixed(),
      targeting: { ...productTargeting, products: [{ id, title: "x" }] },
    });
    expect(parse(withProduct("123")).success).toBe(false);
    expect(parse(withProduct("gid://shopify/Collection/123")).success).toBe(false);
    expect(parse(withProduct("gid://shopify/Product/123")).success).toBe(true);
  });

  it("rejects empty targeting for a specific scope, and IDs for the wrong scope", () => {
    const empty = { ...validFixed(), targeting: { scope: "products", products: [], collections: [] } };
    expect(paths(parse(empty))).toContain("targeting.products");
    const mismatch = { ...validFixed(), targeting: { ...productTargeting, scope: "all" } };
    expect(paths(parse(mismatch))).toContain("targeting.products");
  });

  it("limits targeting to 250 resources", () => {
    const products = Array.from({ length: 251 }, (_, i) => ({ id: `gid://shopify/Product/${i}`, title: "x" }));
    const input = { ...validFixed(), targeting: { scope: "products", products, collections: [] } };
    expect(parse(input).success).toBe(false);
  });
});

describe("T-4 hostile input", () => {
  it("rejects unknown keys at every level", () => {
    expect(parse({ ...validFixed(), shop: "other.myshopify.com" }).success).toBe(false);
    expect(parse({ ...validFixed(), style: { ...validFixed().style, extra: 1 } }).success).toBe(false);
  });

  it("rejects operator objects where a value belongs", () => {
    expect(parse({ ...validFixed(), name: { $gt: "" } }).success).toBe(false);
    expect(parse({ ...validFixed(), startAt: { $gt: "" } }).success).toBe(false);
  });

  it("strips HTML from text", () => {
    const { data } = parse({ ...validFixed(), description: "<img src=x onerror=alert(1)>Sale <b>now</b>" });
    expect(data.description).toBe("Sale now");
  });

  it("rejects a name that is empty once cleaned", () => {
    expect(paths(parse({ ...validFixed(), name: " <b></b> " }))).toContain("name");
  });
});

describe("sanitizeText", () => {
  it("removes nested and unclosed tags", () => {
    expect(sanitizeText("<scr<script>ipt>x")).not.toContain("<script");
    expect(sanitizeText("Sale <img src=x onerror=alert(1)")).toBe("Sale");
  });

  it("removes control characters and trims", () => {
    expect(sanitizeText("  a\u0000b\nc  ")).toBe("abc");
  });

  it("keeps ordinary text, including a less-than sign", () => {
    expect(sanitizeText("Save 50% & more, a < b")).toBe("Save 50% & more, a < b");
  });
});

describe("endMustBeInFuture", () => {
  const input = validFixed();
  const existing = { type: "fixed", startAt: input.startAt, endAt: input.endAt };

  it("applies on create, and when either date changes", () => {
    expect(endMustBeInFuture(input, null)).toBe(true);
    expect(endMustBeInFuture(input, { ...existing, endAt: "2030-12-01T00:00:00.000Z" })).toBe(true);
    expect(endMustBeInFuture(input, { ...existing, startAt: "2030-11-01T00:00:00.000Z" })).toBe(true);
  });

  it("doesn't apply when dates are unchanged, so an expired timer can still be edited", () => {
    expect(endMustBeInFuture(input, existing)).toBe(false);
  });

  it("doesn't apply to evergreen", () => {
    expect(endMustBeInFuture(validEvergreen(), null)).toBe(false);
  });
});
