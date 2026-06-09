import { describe, expect, it } from "vitest";
import { createSortByOrderFn } from "../src/sort.js";
import type { FileTrieNode } from "../src/types.js";

function node(
  name: string,
  order?: number,
  isFolder = false,
): FileTrieNode {
  return {
    displayName: name,
    isFolder,
    data: order === undefined ? { title: name } : { title: name, order },
    children: [],
  };
}

describe("createSortByOrderFn", () => {
  const sort = createSortByOrderFn();

  it("sorts by order ascending", () => {
    const items = [node("C", 30), node("A", 10), node("B", 20)];
    items.sort(sort);
    expect(items.map((item) => item.displayName)).toEqual(["A", "B", "C"]);
  });

  it("places items without order at the end by default", () => {
    const items = [node("No order"), node("Second", 2), node("First", 1)];
    items.sort(sort);
    expect(items.map((item) => item.displayName)).toEqual(["First", "Second", "No order"]);
  });

  it("can place items without order at the start", () => {
    const customSort = createSortByOrderFn({ missingOrderPlacement: "start" });
    const items = [node("Second", 2), node("No order"), node("First", 1)];
    items.sort(customSort);
    expect(items.map((item) => item.displayName)).toEqual(["No order", "First", "Second"]);
  });

  it("keeps folders before files by default", () => {
    const items = [node("note", 1), node("folder", 1, true)];
    items.sort(sort);
    expect(items[0]?.isFolder).toBe(true);
  });

  it("can sort folders and files together", () => {
    const mixedSort = createSortByOrderFn({ foldersFirst: false });
    const items = [node("folder", 20, true), node("note", 10)];
    items.sort(mixedSort);
    expect(items.map((item) => item.displayName)).toEqual(["note", "folder"]);
  });

  it("falls back to alphabetical order when order is equal or missing", () => {
    const items = [node("Beta", 1), node("Alpha", 1), node("Gamma")];
    items.sort(sort);
    expect(items.map((item) => item.displayName)).toEqual(["Alpha", "Beta", "Gamma"]);
  });
});
