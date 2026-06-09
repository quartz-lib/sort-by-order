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
    return typeof value === "number" && Number.isFinite(value) ? value : undefined;
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
function buildExplorerPatchScript(options) {
  const sortFnSource = getSortFnSource(options);
  return `
(function () {
  var sortFnSource = ${JSON.stringify(sortFnSource)};

  function mergeOrderIndex(index) {
    var base = (document.body && document.body.dataset.basepath) || "";
    return fetch(base + "static/orderIndex.json")
      .then(function (response) {
        return response.ok ? response.json() : {};
      })
      .catch(function () {
        return {};
      })
      .then(function (orders) {
        var content = index.content || index;
        for (var slug in content) {
          if (
            Object.prototype.hasOwnProperty.call(content, slug) &&
            orders[slug] != null
          ) {
            content[slug].order = orders[slug];
          }
        }
        return index;
      });
  }

  if (typeof fetchData !== "undefined") {
    var originalFetchData = fetchData;
    fetchData = originalFetchData.then(function (index) {
      return mergeOrderIndex(index);
    });
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

  document.addEventListener("prenav", patchExplorerSortFn);
  document.addEventListener("nav", patchExplorerSortFn, true);
  document.addEventListener("render", patchExplorerSortFn, true);
  patchExplorerSortFn();
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
      js: [
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