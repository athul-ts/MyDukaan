import { forwardRef, useImperativeHandle, useRef, useState } from "react";
import { useMutation } from "react-query";
import { api } from "../api";

export const DeleteModal = forwardRef(function DeleteModal({ onDeleted }, ref) {
  const modalRef = useRef(null);
  const [timer, setTimer] = useState(null);

  const mutation = useMutation((id) => api.deleteTimer(id), {
    onSuccess: (data) => {
      modalRef.current.hideOverlay();
      onDeleted(data);
    },
  });

  useImperativeHandle(ref, () => ({
    open(next) {
      setTimer(next);
      mutation.reset();
      modalRef.current.showOverlay();
    },
  }));

  return (
    <s-modal ref={modalRef} id="delete-modal" heading="Delete this timer?">
      <s-stack direction="block" gap="base">
        {mutation.isError ? (
          <s-banner tone="critical" heading="The timer couldn't be deleted">
            <s-paragraph>{mutation.error.message}</s-paragraph>
          </s-banner>
        ) : null}
        <s-paragraph>
          "{timer?.name}" will stop showing on your store, and its impression count will be lost. This
          can't be undone.
        </s-paragraph>
      </s-stack>
      <s-button slot="secondary-actions" commandFor="delete-modal" command="--hide">
        Cancel
      </s-button>
      <s-button
        slot="primary-action"
        variant="primary"
        tone="critical"
        loading={mutation.isLoading || undefined}
        onClick={() => mutation.mutate(timer.id)}
      >
        Delete timer
      </s-button>
    </s-modal>
  );
});
