import { useEffect, useRef } from "react";

/**
 * Connects a Polaris form element to React. React 18 can't listen for custom element events or
 * set their properties, so this does both on a ref (S4 in specs/10-spikes.md).
 *
 * `s-choice-list` reports through `values`, an array, so it's handled as a single value here.
 */
export function Field({ tag: Tag, value, onChange, onBlur, error, disabled, required, ...rest }) {
  const ref = useRef(null);
  const latest = useRef({ onChange, onBlur });
  latest.current = { onChange, onBlur };

  useEffect(() => {
    const element = ref.current;
    const read = () => (Tag === "s-choice-list" ? element.values?.[0] : element.value);
    const handleChange = () => latest.current.onChange?.(read());
    const handleBlur = () => latest.current.onBlur?.();
    element.addEventListener("input", handleChange);
    element.addEventListener("change", handleChange);
    element.addEventListener("blur", handleBlur);
    return () => {
      element.removeEventListener("input", handleChange);
      element.removeEventListener("change", handleChange);
      element.removeEventListener("blur", handleBlur);
    };
  }, [Tag]);

  useEffect(() => {
    const element = ref.current;
    if (Tag === "s-choice-list") {
      if (element.values?.[0] !== value) element.values = [value];
    } else if (element.value !== value) {
      element.value = value;
    }
  }, [Tag, value]);

  // React 18 writes false as the text "false" on custom elements, so absent values stay undefined.
  return (
    <Tag
      ref={ref}
      error={error || undefined}
      disabled={disabled || undefined}
      required={required || undefined}
      {...rest}
    />
  );
}
