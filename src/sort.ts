import type { FileTrieNode, SortByOrderOptions } from "./types.js";

const defaultOptions: Required<SortByOrderOptions> = {
  orderKey: "order",
  foldersFirst: true,
  missingOrderPlacement: "end",
};

function getOrder(node: FileTrieNode, orderKey: string): number | undefined {
  const value = node.data?.[orderKey];
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  return undefined;
}

function compareDisplayName(a: FileTrieNode, b: FileTrieNode): number {
  return (a.displayName ?? "").localeCompare(b.displayName ?? "", undefined, {
    numeric: true,
    sensitivity: "base",
  });
}

function compareByOrder(
  a: FileTrieNode,
  b: FileTrieNode,
  orderKey: string,
  missingOrderPlacement: "end" | "start",
): number {
  const orderA = getOrder(a, orderKey);
  const orderB = getOrder(b, orderKey);

  if (orderA !== undefined && orderB !== undefined) {
    if (orderA !== orderB) return orderA - orderB;
    return compareDisplayName(a, b);
  }

  if (orderA !== undefined) {
    return missingOrderPlacement === "end" ? -1 : 1;
  }

  if (orderB !== undefined) {
    return missingOrderPlacement === "end" ? 1 : -1;
  }

  return compareDisplayName(a, b);
}

/**
 * Create a sort function for Quartz Explorer that orders nodes by frontmatter `order`.
 *
 * Requires the SortByOrder emitter to inject `order` into `static/contentIndex.json`.
 */
export function createSortByOrderFn(
  userOpts?: SortByOrderOptions,
): (a: FileTrieNode, b: FileTrieNode) => number {
  const opts = { ...defaultOptions, ...userOpts };

  return (a: FileTrieNode, b: FileTrieNode) => {
    if (opts.foldersFirst) {
      if ((!a.isFolder && !b.isFolder) || (a.isFolder && b.isFolder)) {
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

/** Default Explorer sort function using frontmatter `order`. */
export const sortByOrderFn = createSortByOrderFn();
