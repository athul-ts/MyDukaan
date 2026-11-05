import { useEffect, useRef } from "react";
import { formatSchedule, formatTargeting } from "../timerForm";

const STATUS = {
  active: { tone: "success", label: "Active" },
  scheduled: { tone: "info", label: "Scheduled" },
  expired: { tone: "neutral", label: "Expired" },
};

function RowActions({ timer, onEdit, onDelete }) {
  const menuId = `timer-menu-${timer.id}`;
  return (
    <>
      <s-button
        icon="menu-horizontal"
        variant="tertiary"
        accessibilityLabel={`Actions for ${timer.name}`}
        commandFor={menuId}
      />
      <s-menu id={menuId} accessibilityLabel={`Actions for ${timer.name}`}>
        <s-button icon="edit" onClick={() => onEdit(timer)}>
          Edit
        </s-button>
        <s-button icon="delete" tone="critical" onClick={() => onDelete(timer)}>
          Delete
        </s-button>
      </s-menu>
    </>
  );
}

export function TimerTable({ data, timeZone, loading, filters, onEdit, onDelete, onPage }) {
  const ref = useRef(null);
  const onPageRef = useRef(onPage);
  onPageRef.current = onPage;
  const hasPrevious = data.page > 1;
  const hasNext = data.page * data.pageSize < data.total;

  // These are properties with no reliable attribute form under React 18.
  useEffect(() => {
    const table = ref.current;
    table.paginate = hasPrevious || hasNext;
    table.hasPreviousPage = hasPrevious;
    table.hasNextPage = hasNext;
    table.loading = loading;
  }, [hasPrevious, hasNext, loading]);

  useEffect(() => {
    const table = ref.current;
    const next = () => onPageRef.current(1);
    const previous = () => onPageRef.current(-1);
    table.addEventListener("nextpage", next);
    table.addEventListener("previouspage", previous);
    return () => {
      table.removeEventListener("nextpage", next);
      table.removeEventListener("previouspage", previous);
    };
  }, []);

  return (
    <s-table ref={ref}>
      {filters}
      <s-table-header-row>
        <s-table-header listSlot="primary">Name</s-table-header>
        <s-table-header listSlot="inline">Status</s-table-header>
        <s-table-header>Type</s-table-header>
        <s-table-header>Targeting</s-table-header>
        <s-table-header>Schedule</s-table-header>
        <s-table-header format="numeric">Impressions</s-table-header>
        <s-table-header>Actions</s-table-header>
      </s-table-header-row>
      <s-table-body>
        {data.timers.map((timer) => (
          <s-table-row key={timer.id}>
            <s-table-cell>
              <s-stack direction="block" gap="small-300">
                <s-text type="strong">{timer.name}</s-text>
                {timer.description ? <s-text color="subdued">{timer.description}</s-text> : null}
                {timer.overlapsWith?.length > 0 ? (
                  <s-text color="subdued">
                    Competes with {timer.overlapsWith.length} other{" "}
                    {timer.overlapsWith.length === 1 ? "timer" : "timers"}
                  </s-text>
                ) : null}
              </s-stack>
            </s-table-cell>
            <s-table-cell>
              <s-badge tone={STATUS[timer.status].tone}>{STATUS[timer.status].label}</s-badge>
            </s-table-cell>
            <s-table-cell>{timer.type === "fixed" ? "Fixed" : "Evergreen"}</s-table-cell>
            <s-table-cell>{formatTargeting(timer.targeting)}</s-table-cell>
            <s-table-cell>{formatSchedule(timer, timeZone)}</s-table-cell>
            <s-table-cell>{timer.impressions.toLocaleString()}</s-table-cell>
            <s-table-cell>
              <RowActions timer={timer} onEdit={onEdit} onDelete={onDelete} />
            </s-table-cell>
          </s-table-row>
        ))}
      </s-table-body>
    </s-table>
  );
}
