import { render } from "preact";
import { createEvergreenStore } from "../../shared/evergreen.js";
import { ErrorBoundary, Widget } from "./Widget.jsx";

// Shared across blocks, as an impression counts once per timer per page view.
const counted = new Set();
const store = createEvergreenStore(() => window.localStorage);

function configFrom(root) {
  const { productId, collectionIds, proxy, reserved, bar, hintMissing } = root.dataset;
  const query = new URLSearchParams({ productId });
  if (collectionIds) query.set("collectionIds", collectionIds);
  return {
    root,
    proxy,
    url: `${proxy}/timers?${query}`,
    reserved: Number(reserved) || 0,
    bar,
    hintMissing: hintMissing !== undefined,
  };
}

function mountAll() {
  document.querySelectorAll(".cdt-root").forEach((root) => {
    try {
      // The script tag is repeated per block, so a root must only ever mount once.
      if (root.dataset.cdtMounted) return;
      root.dataset.cdtMounted = "1";
      render(
        <ErrorBoundary>
          <Widget config={configFrom(root)} store={store} counted={counted} />
        </ErrorBoundary>,
        root,
      );
    } catch {
      /* One bad block must not stop the others or touch the page. */
    }
  });
}

try {
  mountAll();
  if (window.Shopify?.designMode) document.addEventListener("shopify:section:load", mountAll);
} catch {
  /* The storefront must never see a widget failure. */
}
