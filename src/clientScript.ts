import type { SortByOrderOptions } from "./types.js";

const defaultOptions: Required<SortByOrderOptions> = {
  orderKey: "order",
  foldersFirst: true,
  missingOrderPlacement: "end",
};

/**
 * Build a self-contained sortFn source string for Explorer's client-side evaluator.
 * Must not reference closure variables — Explorer reconstructs it via `new Function`.
 */
export function getSortFnSource(userOpts?: SortByOrderOptions): string {
  const opts = { ...defaultOptions, ...userOpts };
  const orderKey = JSON.stringify(opts.orderKey);
  const foldersFirst = String(opts.foldersFirst);
  const missingOrderPlacement = JSON.stringify(opts.missingOrderPlacement);

  return `(a, b) => {
  const orderKey = ${orderKey};
  const foldersFirst = ${foldersFirst};
  const missingOrderPlacement = ${missingOrderPlacement};

  function getOrder(node) {
    const value = node.data && node.data[orderKey];
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }

    const orderBySlug =
      (typeof window !== "undefined" && window.__sortByOrderMap) || {};
    const slug = (node.data && node.data.slug) || node.slug;
    if (slug && orderBySlug[slug] != null) {
      return orderBySlug[slug];
    }

    return undefined;
  }

  function compareDisplayName(x, y) {
    return (x.displayName || "").localeCompare(y.displayName || "", undefined, {
      numeric: true,
      sensitivity: "base",
    });
  }

  function compareByOrder(x, y) {
    const orderA = getOrder(x);
    const orderB = getOrder(y);

    if (orderA !== undefined && orderB !== undefined) {
      if (orderA !== orderB) return orderA - orderB;
      return compareDisplayName(x, y);
    }

    if (orderA !== undefined) {
      return missingOrderPlacement === "end" ? -1 : 1;
    }

    if (orderB !== undefined) {
      return missingOrderPlacement === "end" ? 1 : -1;
    }

    return compareDisplayName(x, y);
  }

  if (foldersFirst) {
    if ((!a.isFolder && !b.isFolder) || (a.isFolder && b.isFolder)) {
      return compareByOrder(a, b);
    }
    if (!a.isFolder && b.isFolder) return 1;
    return -1;
  }

  return compareByOrder(a, b);
}`;
}

/** Mirrors @quartz-community/utils/path resolveBasePath for client-side fetches. */
const resolveBasePathSource = `
function resolveBasePath(to) {
  var base = (document.body && document.body.dataset.basepath) || "";
  var slug = to.charAt(0) === "/" ? to : "/" + to;
  return base + slug;
}`;

/** Hide Explorer until order data is ready to avoid a visible re-sort on refresh. */
export const explorerPendingCss = `
html.sort-by-order-pending .explorer .explorer-ul {
  visibility: hidden;
}`;

/**
 * Start fetching orderIndex.json as early as possible (before DOM is ready).
 * Sites deployed under a subpath are retried in the afterDOMReady bootstrap.
 */
export function buildOrderIndexPrefetchScript(): string {
  return `
(function () {
  window.__sortByOrderMap = {};
  window.__sortByOrderReady = fetch("/static/orderIndex.json")
    .then(function (response) {
      return response.ok ? response.json() : {};
    })
    .catch(function () {
      return {};
    })
    .then(function (orders) {
      window.__sortByOrderMap = orders;
      return orders;
    });
})();
`.trim();
}

/**
 * Patch Explorer before it builds the file tree.
 * Injected via the emitter's externalResources() hook.
 */
export function buildExplorerPatchScript(options: SortByOrderOptions): string {
  const sortFnSource = getSortFnSource(options);

  return `
(function () {
  var sortFnSource = ${JSON.stringify(sortFnSource)};
  ${resolveBasePathSource}

  var orderReady = false;

  function fetchOrderIndex() {
    return fetch(resolveBasePath("static/orderIndex.json"))
      .then(function (response) {
        return response.ok ? response.json() : {};
      })
      .catch(function () {
        return {};
      });
  }

  function loadOrderIndex() {
    var existing = window.__sortByOrderReady;
    if (existing) {
      return existing.then(function (orders) {
        if (orders && Object.keys(orders).length > 0) {
          window.__sortByOrderMap = orders;
          return orders;
        }
        return fetchOrderIndex().then(function (orders) {
          window.__sortByOrderMap = orders;
          return orders;
        });
      });
    }

    window.__sortByOrderReady = fetchOrderIndex().then(function (orders) {
      window.__sortByOrderMap = orders;
      return orders;
    });
    return window.__sortByOrderReady;
  }

  function revealExplorer() {
    document.documentElement.classList.remove("sort-by-order-pending");
  }

  function revealWhenExplorerRendered() {
    var explorerUl = document.querySelector(".explorer .explorer-ul");
    if (!explorerUl) {
      revealExplorer();
      return;
    }

    if (explorerUl.children.length > 1) {
      revealExplorer();
      return;
    }

    var observer = new MutationObserver(function () {
      if (explorerUl.children.length > 1) {
        observer.disconnect();
        revealExplorer();
      }
    });
    observer.observe(explorerUl, { childList: true });
    setTimeout(function () {
      observer.disconnect();
      revealExplorer();
    }, 500);
  }

  function gateNavUntilReady(event) {
    if (orderReady) return;
    event.stopImmediatePropagation();
  }

  function patchExplorerSortFn() {
    var explorers = document.querySelectorAll("div.explorer");
    for (var i = 0; i < explorers.length; i++) {
      var explorer = explorers[i];
      var dataFns = JSON.parse(explorer.dataset.dataFns || "{}");
      dataFns.sortFn = sortFnSource;
      explorer.dataset.dataFns = JSON.stringify(dataFns);
    }
  }

  function bootstrapExplorer() {
    document.documentElement.classList.add("sort-by-order-pending");
    document.addEventListener("nav", gateNavUntilReady, true);
    patchExplorerSortFn();

    loadOrderIndex().then(function () {
      orderReady = true;
      document.removeEventListener("nav", gateNavUntilReady, true);
      patchExplorerSortFn();

      var url =
        (document.body && document.body.dataset.slug) ||
        location.pathname.replace(/^\\/+/, "");
      document.dispatchEvent(new CustomEvent("nav", { detail: { url: url } }));
      revealWhenExplorerRendered();
    });
  }

  window.__sortByOrderMap = window.__sortByOrderMap || {};
  document.addEventListener("prenav", patchExplorerSortFn);
  document.addEventListener("nav", patchExplorerSortFn, true);
  document.addEventListener("render", patchExplorerSortFn, true);
  bootstrapExplorer();
})();
`.trim();
}
