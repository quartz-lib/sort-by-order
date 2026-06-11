import { createRequire } from 'module';
import path from 'path';
import fs from 'fs/promises';

createRequire(import.meta.url);

// node_modules/@quartz-community/types/dist/index.js
function joinSegments(...segments) {
  return segments.filter((segment) => segment.length > 0).join("/").replace(/\/+/g, "/");
}

// src/clientScript.ts
var defaultOptions = {
  orderKey: "order",
  foldersFirst: true,
  missingOrderPlacement: "end"
};
function getSortFnSource(userOpts) {
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
var resolveBasePathSource = `
function resolveBasePath(to) {
  var base = (document.body && document.body.dataset.basepath) || "";
  var slug = to.charAt(0) === "/" ? to : "/" + to;
  return base + slug;
}`;
var explorerPendingCss = `
html.sort-by-order-pending .explorer .explorer-ul {
  visibility: hidden;
}`;
function buildOrderIndexPrefetchScript() {
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
function buildExplorerPatchScript(options) {
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

// src/emitter.ts
var defaultOptions2 = {
  orderKey: "order",
  foldersFirst: true,
  missingOrderPlacement: "end"
};
function parseOrder(value) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return void 0;
}
function buildOrderMap(content, orderKey) {
  const orderBySlug = /* @__PURE__ */ new Map();
  for (const [, file] of content) {
    const data = file.data ?? {};
    if (data.unlisted === true) continue;
    const slug = data.slug;
    if (!slug) continue;
    const frontmatter = data.frontmatter ?? {};
    const order = parseOrder(frontmatter[orderKey]);
    if (order !== void 0) {
      orderBySlug.set(slug, order);
    }
  }
  return orderBySlug;
}
async function emitOrderIndex(ctx, content, orderKey) {
  const orderBySlug = buildOrderMap(content, orderKey);
  const indexPath = joinSegments(ctx.argv.output, "static/orderIndex.json");
  await fs.mkdir(path.dirname(indexPath), { recursive: true });
  await fs.writeFile(indexPath, JSON.stringify(Object.fromEntries(orderBySlug)));
  return [indexPath];
}
var SortByOrder = (userOpts) => {
  const options = { ...defaultOptions2, ...userOpts };
  const emit = async (ctx, content) => {
    return emitOrderIndex(ctx, content, options.orderKey);
  };
  return {
    name: "SortByOrder",
    emit,
    async *partialEmit(ctx, content) {
      const outputs = await emit(ctx, content);
      for (const outputPath of outputs) {
        yield outputPath;
      }
    },
    externalResources: () => ({
      css: [
        {
          content: explorerPendingCss,
          inline: true,
          spaPreserve: true
        }
      ],
      js: [
        {
          loadTime: "beforeDOMReady",
          contentType: "inline",
          script: buildOrderIndexPrefetchScript(),
          spaPreserve: true
        },
        {
          loadTime: "afterDOMReady",
          contentType: "inline",
          script: buildExplorerPatchScript(options),
          spaPreserve: true
        }
      ]
    })
  };
};

// src/sort.ts
var defaultOptions3 = {
  orderKey: "order",
  foldersFirst: true,
  missingOrderPlacement: "end"
};
function getOrder(node, orderKey) {
  const value = node.data?.[orderKey];
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  return void 0;
}
function compareDisplayName(a, b) {
  return (a.displayName ?? "").localeCompare(b.displayName ?? "", void 0, {
    numeric: true,
    sensitivity: "base"
  });
}
function compareByOrder(a, b, orderKey, missingOrderPlacement) {
  const orderA = getOrder(a, orderKey);
  const orderB = getOrder(b, orderKey);
  if (orderA !== void 0 && orderB !== void 0) {
    if (orderA !== orderB) return orderA - orderB;
    return compareDisplayName(a, b);
  }
  if (orderA !== void 0) {
    return missingOrderPlacement === "end" ? -1 : 1;
  }
  if (orderB !== void 0) {
    return missingOrderPlacement === "end" ? 1 : -1;
  }
  return compareDisplayName(a, b);
}
function createSortByOrderFn(userOpts) {
  const opts = { ...defaultOptions3, ...userOpts };
  return (a, b) => {
    if (opts.foldersFirst) {
      if (!a.isFolder && !b.isFolder || a.isFolder && b.isFolder) {
        return compareByOrder(a, b, opts.orderKey, opts.missingOrderPlacement);
      }
      if (!a.isFolder && b.isFolder) {
        return 1;
      }
      return -1;
    }
    return compareByOrder(a, b, opts.orderKey, opts.missingOrderPlacement);
  };
}
var sortByOrderFn = createSortByOrderFn();

export { SortByOrder, createSortByOrderFn, sortByOrderFn };
//# sourceMappingURL=index.js.map
//# sourceMappingURL=index.js.map