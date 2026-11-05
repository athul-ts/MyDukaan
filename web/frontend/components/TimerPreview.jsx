import { HEX_COLOR } from "../timerForm";

const HEIGHT = { small: 56, medium: 72, large: 96 };
const safeColor = (value, fallback) => (HEX_COLOR.test(value) ? value : fallback);
const oneLine = { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" };

/** A static preview using the same heights the storefront reserves (specs/05-widget.md). */
export function TimerPreview({ form }) {
  const isSmall = form.size === "small";
  return (
    <div
      aria-label="Timer preview"
      style={{
        background: safeColor(form.backgroundColor, "#111111"),
        color: safeColor(form.textColor, "#FFFFFF"),
        height: HEIGHT[form.size],
        borderRadius: 8,
        padding: "8px 12px",
        boxSizing: "border-box",
        display: "flex",
        flexDirection: isSmall ? "row" : "column",
        alignItems: "center",
        justifyContent: "center",
        gap: isSmall ? 12 : 0,
        fontVariantNumeric: "tabular-nums",
        overflow: "hidden",
      }}
    >
      <div style={{ ...oneLine, maxWidth: "100%", fontSize: 13 }}>{form.headline}</div>
      <div style={{ fontWeight: 600, fontSize: form.size === "large" ? 22 : 16 }}>00:05:00</div>
      {isSmall || !form.description ? null : (
        <div style={{ ...oneLine, maxWidth: "100%", fontSize: 12 }}>{form.description}</div>
      )}
    </div>
  );
}
