import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { useMutation } from "react-query";
import { api, ApiError } from "../api";
import { emptyForm, errorsFromDetails, formFromTimer, validateForm } from "../timerForm";
import { Field } from "./Field";
import { TimeField } from "./TimeField";
import { TimerPreview } from "./TimerPreview";

const twoColumns = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 };

export const TimerModal = forwardRef(function TimerModal(
  { timeZone, shopFailed, onRetryShop, onSaved },
  ref,
) {
  const modalRef = useRef(null);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const dirty = useRef(false);

  useImperativeHandle(ref, () => ({
    /** Modals can only open from a user action, so this must run inside a click handler. */
    open(timer = null) {
      setEditing(timer);
      setForm(timer ? formFromTimer(timer, timeZone) : emptyForm());
      setErrors({});
      setTouched({});
      setSubmitted(false);
      dirty.current = false;
      mutation.reset();
      modalRef.current.showOverlay();
    },
  }));

  // If the timezone arrives after opening, show the schedule, unless the merchant has started editing.
  useEffect(() => {
    if (timeZone && editing && !dirty.current) setForm(formFromTimer(editing, timeZone));
  }, [timeZone, editing]);

  const mutation = useMutation(
    (payload) => (editing ? api.updateTimer(editing.id, payload) : api.createTimer(payload)),
    {
      onSuccess: (data) => {
        modalRef.current.hideOverlay();
        onSaved(data, Boolean(editing));
      },
      onError: (error) => {
        // Contents are kept, so the merchant can correct the problem and save again.
        if (error instanceof ApiError && error.details.length) {
          setErrors(errorsFromDetails(error.details));
        } else {
          setErrors({ form: error.message });
        }
      },
    },
  );

  const validate = (next) => validateForm(next, timeZone, { existing: editing });

  const update = (field, value) => {
    dirty.current = true;
    setForm((current) => {
      const next = { ...current, [field]: value };
      if (submitted) setErrors(validate(next).errors);
      else if (touched[field]) {
        const fieldErrors = validate(next).errors;
        setErrors((previous) => ({ ...previous, [field]: fieldErrors[field] }));
      }
      return next;
    });
  };

  const blur = (field) => () => {
    setTouched((previous) => ({ ...previous, [field]: true }));
    const fieldErrors = validate(form).errors;
    setErrors((previous) => ({ ...previous, [field]: fieldErrors[field] }));
  };

  const field = (name) => ({
    value: form[name],
    onChange: (value) => update(name, value),
    onBlur: blur(name),
    error: errors[name],
  });

  const save = () => {
    setSubmitted(true);
    const { payload, errors: found, valid } = validate(form);
    setErrors(found);
    if (valid) mutation.mutate(payload);
  };

  const pick = async (type, key) => {
    const selected = await shopify.resourcePicker({
      type,
      multiple: 250,
      selectionIds: form[key].map((item) => ({ id: item.id })),
    });
    // Undefined means cancelled, so the current list stays.
    if (selected) update(key, selected.map(({ id, title }) => ({ id, title })));
  };

  const remove = (key, id) => update(key, form[key].filter((item) => item.id !== id));

  const isFixed = form.type === "fixed";
  const fixedBlocked = isFixed && !timeZone;
  const list = form.scope === "products" ? "products" : "collections";
  const scopeWord = form.scope === "products" ? "product" : "collection";
  const errorCount = Object.values(errors).filter(Boolean).length;

  return (
    <s-modal
      ref={modalRef}
      id="timer-modal"
      size="large"
      heading={editing ? "Edit timer" : "Create New Timer"}
    >
      <s-stack direction="block" gap="base">
        {shopFailed && isFixed ? (
          <s-banner tone="critical" heading="The store's timezone couldn't be loaded">
            <s-paragraph>
              Schedules are entered in the store's timezone, so a fixed timer can't be saved until it
              loads.
            </s-paragraph>
            <s-button slot="secondary-actions" onClick={onRetryShop}>
              Try again
            </s-button>
          </s-banner>
        ) : null}

        {submitted && errorCount > 0 ? (
          <s-banner tone="critical" heading="Please fix the highlighted fields">
            {errors.form ? <s-paragraph>{errors.form}</s-paragraph> : null}
          </s-banner>
        ) : null}

        <Field tag="s-text-field" label="Timer name" required placeholder="Enter timer name" maxLength={80} {...field("name")} />
        <Field tag="s-text-field" label="Headline" maxLength={60} {...field("headline")} />
        <Field tag="s-text-area" label="Promotion description" placeholder="Enter promotion details" rows={2} maxLength={200} {...field("description")} />

        <Field tag="s-choice-list" label="Timer type" {...field("type")}>
          <s-choice value="fixed">Fixed: everyone sees the same start and end</s-choice>
          <s-choice value="evergreen">Evergreen: restarts for each visitor</s-choice>
        </Field>

        {isFixed ? (
          <>
            <div style={twoColumns}>
              <Field tag="s-date-field" label="Start date" disabled={fixedBlocked} {...field("startDate")} />
              <TimeField id="start-time" label="Start time" disabled={fixedBlocked} {...field("startTime")} />
            </div>
            <div style={twoColumns}>
              <Field tag="s-date-field" label="End date" disabled={fixedBlocked} {...field("endDate")} />
              <TimeField id="end-time" label="End time" disabled={fixedBlocked} {...field("endTime")} />
            </div>
            <s-text color="subdued">
              {timeZone ? `Times are in the store's timezone: ${timeZone}` : "Waiting for the store's timezone"}
            </s-text>
          </>
        ) : (
          <div style={twoColumns}>
            <Field tag="s-number-field" label="Duration" min={1} {...field("durationValue")} />
            <Field tag="s-select" label="Unit" {...field("durationUnit")}>
              <s-option value="minutes">Minutes</s-option>
              <s-option value="hours">Hours</s-option>
            </Field>
          </div>
        )}

        <Field tag="s-choice-list" label="Show on" {...field("scope")}>
          <s-choice value="all">All products</s-choice>
          <s-choice value="products">Specific products</s-choice>
          <s-choice value="collections">Specific collections</s-choice>
        </Field>

        {form.scope !== "all" ? (
          <s-stack direction="block" gap="small">
            <div>
              <s-button onClick={() => pick(scopeWord, list)}>Choose {list}</s-button>
            </div>
            {errors.targeting ? <s-text tone="critical">{errors.targeting}</s-text> : null}
            {form[list].map((item) => (
              <div key={item.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                <s-text>{item.title}</s-text>
                <s-button variant="tertiary" accessibilityLabel={`Remove ${item.title}`} onClick={() => remove(list, item.id)}>
                  Remove
                </s-button>
              </div>
            ))}
          </s-stack>
        ) : null}

        <div style={twoColumns}>
          <Field tag="s-color-field" label="Background colour" {...field("backgroundColor")} />
          <Field tag="s-color-field" label="Text colour" {...field("textColor")} />
        </div>
        <div style={twoColumns}>
          <Field tag="s-select" label="Timer size" details={form.size === "small" ? "Small hides the description" : undefined} {...field("size")}>
            <s-option value="small">Small</s-option>
            <s-option value="medium">Medium</s-option>
            <s-option value="large">Large</s-option>
          </Field>
          <Field tag="s-select" label="Timer position" {...field("position")}>
            <s-option value="inline">Inline, where the block is placed</s-option>
            <s-option value="top_bar">Top bar</s-option>
            <s-option value="bottom_bar">Bottom bar</s-option>
          </Field>
        </div>

        <div style={twoColumns}>
          <Field tag="s-select" label="Urgency notification" {...field("urgencyMode")}>
            <s-option value="none">None</s-option>
            <s-option value="color_pulse">Color pulse</s-option>
          </Field>
          {form.urgencyMode === "none" ? null : (
            <Field tag="s-number-field" label="Start when this many minutes are left" min={1} {...field("threshold")} />
          )}
        </div>

        <s-stack direction="block" gap="small-300">
          <s-text color="subdued">Preview</s-text>
          <TimerPreview form={form} />
        </s-stack>
      </s-stack>

      <s-button slot="secondary-actions" commandFor="timer-modal" command="--hide">
        Cancel
      </s-button>
      <s-button
        slot="primary-action"
        variant="primary"
        loading={mutation.isLoading || undefined}
        onClick={save}
      >
        {editing ? "Save timer" : "Create timer"}
      </s-button>
    </s-modal>
  );
});
