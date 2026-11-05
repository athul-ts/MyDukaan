import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { fromClock, toClock } from "../timerForm";
import { Field } from "./Field";

const HOURS = Array.from({ length: 12 }, (_, index) => index + 1);
const MINUTES = Array.from({ length: 60 }, (_, index) => index);
const PERIODS = ["AM", "PM"];
const ROW_HEIGHT = 36;
const pad = (number) => String(number).padStart(2, "0");

const columnStyle = {
  height: ROW_HEIGHT * 6,
  overflowY: "auto",
  scrollbarWidth: "thin",
  width: 56,
  position: "relative",
};

function Column({ label, items, selected, format, onSelect, columnRef }) {
  return (
    <div ref={columnRef} role="group" aria-label={label} style={columnStyle}>
      {items.map((item) => (
        // A plain row carries the position: s-clickable itself has no layout box to measure.
        <div key={item} data-value={item}>
          <s-clickable
            padding="small-200"
            borderRadius="base"
            background={item === selected ? "strong" : undefined}
            accessibilityLabel={`${label} ${format(item)}`}
            onClick={() => onSelect(item)}
          >
            <div style={{ textAlign: "center", lineHeight: "20px" }}>
              <s-text type={item === selected ? "strong" : undefined}>{format(item)}</s-text>
            </div>
          </s-clickable>
        </div>
      ))}
    </div>
  );
}

/**
 * Polaris has no time component (S4 in specs/10-spikes.md), so this is built the way Polaris
 * builds its colour field: a text field, plus a button that opens a popover. Any time can still be
 * typed as HH:mm. The popover has hour, minute and AM/PM columns, and only OK changes the value.
 */
export function TimeField({ id, label, value, onChange, onBlur, error, disabled }) {
  const wrapper = useRef(null);
  const popover = useRef(null);
  const columns = { hour: useRef(null), minute: useRef(null), period: useRef(null) };
  const open = useRef(false);
  const latest = useRef(value);
  latest.current = value;
  const [draft, setDraft] = useState(() => toClock(value));
  const [opening, setOpening] = useState(0);
  const popoverId = `${id}-picker`;

  useEffect(() => {
    const element = popover.current;
    const onShow = () => {
      open.current = true;
      setDraft(toClock(latest.current));
      setOpening((count) => count + 1);
    };
    const onHide = () => {
      open.current = false;
    };
    element.addEventListener("show", onShow);
    element.addEventListener("hide", onHide);
    return () => {
      element.removeEventListener("show", onShow);
      element.removeEventListener("hide", onHide);
    };
  }, []);

  // Escape closes only the picker. Without this, the modal around the form closes as well.
  useEffect(() => {
    const element = wrapper.current;
    const onKeyDown = (event) => {
      if (event.key === "Escape" && open.current) event.stopPropagation();
    };
    element.addEventListener("keydown", onKeyDown);
    return () => element.removeEventListener("keydown", onKeyDown);
  }, []);

  // Each time it opens, every column scrolls its chosen row to the middle. The popover is only laid
  // out after it's shown, so this waits for the next frames.
  useLayoutEffect(() => {
    if (!opening) return undefined;
    let frame = requestAnimationFrame(() => {
      frame = requestAnimationFrame(() => {
        for (const [key, ref] of Object.entries(columns)) {
          const row = ref.current?.querySelector(`[data-value="${draft[key]}"]`);
          if (row) ref.current.scrollTop = row.offsetTop - ref.current.clientHeight / 2 + row.offsetHeight / 2;
        }
      });
    });
    return () => cancelAnimationFrame(frame);
    // Only on opening, not on each pick, which would move the list under the pointer.
  }, [opening]);

  const choose = (key) => (item) => setDraft((current) => ({ ...current, [key]: item }));

  return (
    <div ref={wrapper}>
      <Field
        tag="s-text-field"
        label={label}
        icon="clock"
        placeholder="HH:mm"
        value={value}
        onChange={onChange}
        onBlur={onBlur}
        error={error}
        disabled={disabled}
      >
        <s-clickable
          slot="accessory"
          commandFor={popoverId}
          accessibilityLabel={`Choose ${label.toLowerCase()}`}
          disabled={disabled || undefined}
        >
          <s-icon type="caret-down" />
        </s-clickable>
      </Field>
      <s-popover ref={popover} id={popoverId}>
        <s-box padding="base">
          <s-stack direction="block" gap="base">
            <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
              <Column label="Hour" items={HOURS} selected={draft.hour} format={String} onSelect={choose("hour")} columnRef={columns.hour} />
              <Column label="Minute" items={MINUTES} selected={draft.minute} format={pad} onSelect={choose("minute")} columnRef={columns.minute} />
              <Column label="Period" items={PERIODS} selected={draft.period} format={String} onSelect={choose("period")} columnRef={columns.period} />
            </div>
            <s-stack direction="inline" gap="small" justifyContent="end">
              <s-button variant="tertiary" commandFor={popoverId} command="--hide">
                Cancel
              </s-button>
              <s-button variant="primary" commandFor={popoverId} command="--hide" onClick={() => onChange(fromClock(draft))}>
                OK
              </s-button>
            </s-stack>
          </s-stack>
        </s-box>
      </s-popover>
    </div>
  );
}
