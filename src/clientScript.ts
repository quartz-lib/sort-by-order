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

  function loadOrderIndex() {
    return fetch(resolveBasePath("static/orderIndex.json"))
      .then(function (response) {
        return response.ok ? response.json() : {};
      })
      .catch(function () {
        return {};
      })
      .then(function (orders) {
        window.__sortByOrderMap = orders;
        var url =
          (document.body && document.body.dataset.slug) ||
          location.pathname.replace(/^\\/+/, "");
        document.dispatchEvent(
          new CustomEvent("nav", { detail: { url: url } }),
        );
        return orders;
      });
  }

  window.__sortByOrderMap = window.__sortByOrderMap || {};
  loadOrderIndex();

  function patchExplorerSortFn() {
    var explorers = document.querySelectorAll("div.explorer");
    for (var i = 0; i < explorers.length; i++) {
      var explorer = explorers[i];
      var dataFns = JSON.parse(explorer.dataset.dataFns || "{}");
      dataFns.sortFn = sortFnSource;
      explorer.dataset.dataFns = JSON.stringify(dataFns);
    }
  }

  document.addEventListener("prenav", patchExplorerSortFn);
  document.addEventListener("nav", patchExplorerSortFn, true);
  document.addEventListener("render", patchExplorerSortFn, true);
  patchExplorerSortFn();
})();
`.trim();
}
