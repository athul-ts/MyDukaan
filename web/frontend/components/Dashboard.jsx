import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "react-query";
import { api } from "../api";
import { DeleteModal } from "./DeleteModal";
import { Field } from "./Field";
import { TimerModal } from "./TimerModal";
import { TimerTable } from "./TimerTable";

const PAGE_SIZE = 20;
const BLOCK_HANDLE = "countdown-timer";
// Only used by the filter. An empty option value doesn't reach us as "" from s-select, and the
// API rejects anything that isn't a real status, so this one is left out of the request.
const ALL_STATUSES = "all";

function useDebounced(value, delayMs) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timeout = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timeout);
  }, [value, delayMs]);
  return debounced;
}

export function Dashboard() {
  const queryClient = useQueryClient();
  const timerModal = useRef(null);
  const deleteModal = useRef(null);

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState(ALL_STATUSES);
  const [sort, setSort] = useState("createdAt_desc");
  const [page, setPage] = useState(1);
  const q = useDebounced(search.trim(), 300);

  useEffect(() => setPage(1), [q, status, sort]);

  const params = {
    q,
    status: status === ALL_STATUSES ? "" : status,
    sort,
    page,
    pageSize: PAGE_SIZE,
  };
  const timers = useQuery(["timers", params], () => api.listTimers(params), {
    keepPreviousData: true,
  });
  const shop = useQuery("shop", api.getShop);
  const timeZone = shop.data?.ianaTimezone ?? null;

  const refresh = () => queryClient.invalidateQueries("timers");
  const warnIfSyncFailed = (data, message) => {
    if (data.hintSync === "failed") {
      shopify.toast.show(`${message}, but the storefront may be out of date`, { isError: true });
    } else {
      shopify.toast.show(message);
    }
  };

  const retrySync = useMutation(api.syncHint, {
    onSuccess: (data) => {
      refresh();
      if (data.hintSync === "ok") shopify.toast.show("Storefront updated");
      else shopify.toast.show("Still couldn't update the storefront", { isError: true });
    },
    onError: () => shopify.toast.show("Still couldn't update the storefront", { isError: true }),
  });

  const data = timers.data;
  const hasFilters = Boolean(q) || status !== ALL_STATUSES;
  const isEmptyShop = data && data.total === 0 && !hasFilters;
  const blockLink = `shopify://admin/themes/current/editor?template=product&addAppBlockId=${shopify.config.apiKey}/${BLOCK_HANDLE}&target=mainSection`;

  const filters = (
    <s-stack slot="filters" direction="inline" gap="small">
      <div style={{ flex: "1 1 220px" }}>
        <Field tag="s-search-field" label="Search timers" labelAccessibilityVisibility="exclusive" placeholder="Search timers" value={search} onChange={setSearch} />
      </div>
      <Field tag="s-select" label="Status" labelAccessibilityVisibility="exclusive" value={status} onChange={setStatus}>
        <s-option value={ALL_STATUSES}>All statuses</s-option>
        <s-option value="active">Active</s-option>
        <s-option value="scheduled">Scheduled</s-option>
        <s-option value="expired">Expired</s-option>
      </Field>
      <Field tag="s-select" label="Sort" labelAccessibilityVisibility="exclusive" value={sort} onChange={setSort}>
        <s-option value="createdAt_desc">Newest first</s-option>
        <s-option value="endAt_asc">Ending soonest</s-option>
        <s-option value="name_asc">Name A to Z</s-option>
      </Field>
    </s-stack>
  );

  return (
    <s-page heading="Countdown Timer Manager">
      <s-button slot="primary-action" variant="primary" icon="plus" onClick={() => timerModal.current.open()}>
        Create timer
      </s-button>

      <s-stack direction="block" gap="base">
        {data?.hintSync === "failed" ? (
          <s-banner tone="warning" heading="Your storefront may be out of date">
            <s-paragraph>
              The latest timer changes couldn't be sent to Shopify, so new timers may not show yet.
            </s-paragraph>
            <s-button slot="secondary-actions" loading={retrySync.isLoading || undefined} onClick={() => retrySync.mutate()}>
              Retry
            </s-button>
          </s-banner>
        ) : null}

        {shop.isError ? (
          <s-banner tone="warning" heading="The store's timezone couldn't be loaded">
            <s-paragraph>Schedules below are shown in UTC.</s-paragraph>
            <s-button slot="secondary-actions" onClick={() => shop.refetch()}>
              Try again
            </s-button>
          </s-banner>
        ) : null}

        {timers.isError ? (
          <s-banner tone="critical" heading="Your timers couldn't be loaded">
            <s-paragraph>{timers.error.message}</s-paragraph>
            <s-button slot="secondary-actions" onClick={() => timers.refetch()}>
              Try again
            </s-button>
          </s-banner>
        ) : null}

        <s-section>
          <s-stack direction="block" gap="small">
            <s-paragraph>Create and manage countdown timers for your promotions.</s-paragraph>
            <div>
              <s-button href={blockLink} target="_top">
                Add the timer block to your theme
              </s-button>
            </div>
          </s-stack>
        </s-section>

        {timers.isLoading ? (
          <s-section>
            <s-stack direction="block" gap="base">
              <s-spinner accessibilityLabel="Loading timers" />
            </s-stack>
          </s-section>
        ) : null}

        {isEmptyShop ? (
          <s-section heading="No timers yet">
            <s-stack direction="block" gap="base">
              <s-paragraph>
                Timers show a countdown on your product pages to add urgency to a promotion.
              </s-paragraph>
              <div>
                <s-button variant="primary" onClick={() => timerModal.current.open()}>
                  Create your first timer
                </s-button>
              </div>
            </s-stack>
          </s-section>
        ) : null}

        {data && !isEmptyShop ? (
          <s-section padding="none">
            <TimerTable
              data={data}
              timeZone={timeZone}
              loading={timers.isFetching}
              filters={filters}
              onEdit={(timer) => timerModal.current.open(timer)}
              onDelete={(timer) => deleteModal.current.open(timer)}
              onPage={(change) => setPage((current) => Math.max(1, current + change))}
            />
            {data.total === 0 ? (
              <s-box padding="base">
                <s-paragraph>No timers match these filters.</s-paragraph>
              </s-box>
            ) : null}
          </s-section>
        ) : null}
      </s-stack>

      <TimerModal
        ref={timerModal}
        timeZone={timeZone}
        shopFailed={shop.isError}
        onRetryShop={() => shop.refetch()}
        onSaved={(result, wasEdit) => {
          refresh();
          warnIfSyncFailed(result, wasEdit ? "Timer saved" : "Timer created");
        }}
      />
      <DeleteModal
        ref={deleteModal}
        onDeleted={(result) => {
          refresh();
          warnIfSyncFailed(result, "Timer deleted");
        }}
      />
    </s-page>
  );
}
