import { createRequire } from 'module';
import path from 'path';
import fs from 'fs/promises';

createRequire(import.meta.url);

// node_modules/@quartz-community/types/dist/index.js
function joinSegments(...segments) {
  return segments.filter((segment) => segment.length > 0).join("/").replace(/\/+/g, "/");
}

// src/emitter.ts
var defaultOptions = {
  orderKey: "order"
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
async function augmentContentIndex(ctx, content, orderKey) {
  const indexPath = joinSegments(ctx.argv.output, "static/contentIndex.json");
  let index;
  try {
    index = JSON.parse(await fs.readFile(indexPath, "utf-8"));
  } catch {
    return [];
  }
  const orderBySlug = buildOrderMap(content, orderKey);
  for (const [slug, entry] of Object.entries(index)) {
    const order = orderBySlug.get(slug);
    if (order !== void 0) {
      entry.order = order;
    } else {
      delete entry.order;
    }
  }
  await fs.mkdir(path.dirname(indexPath), { recursive: true });
  await fs.writeFile(indexPath, JSON.stringify(index));
  return [indexPath];
}
var SortByOrder = (userOpts) => {
  const options = { ...defaultOptions, ...userOpts };
  const emit = async (ctx, content) => {
    return augmentContentIndex(ctx, content, options.orderKey);
  };
  return {
    name: "SortByOrder",
    emit,
    async *partialEmit(ctx, content) {
      const outputs = await emit(ctx, content);
      for (const outputPath of outputs) {
        yield outputPath;
      }
    }
  };
};

// src/sort.ts
var defaultOptions2 = {
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
  const opts = { ...defaultOptions2, ...userOpts };
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