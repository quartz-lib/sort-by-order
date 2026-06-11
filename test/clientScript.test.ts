import { describe, expect, it } from "vitest";
import {
  buildExplorerPatchScript,
  buildOrderIndexPrefetchScript,
  explorerPendingCss,
  getSortFnSource,
} from "../src/clientScript.js";

describe("clientScript", () => {
  it("serializes sortFn for Explorer", () => {
    const source = getSortFnSource({ orderKey: "order" });
    expect(source).toContain("order");
    expect(source.startsWith("(")).toBe(true);
  });

  it("builds a self-contained sortFn with inlined options", () => {
    const source = getSortFnSource({
      orderKey: "noteOrder",
      foldersFirst: false,
      missingOrderPlacement: "start",
    });
    expect(source).toContain('const orderKey = "noteOrder"');
    expect(source).toContain("const foldersFirst = false");
    expect(source).not.toContain("opts.");
  });

  it("builds a patch script that always overrides Explorer sortFn", () => {
    const script = buildExplorerPatchScript({ foldersFirst: false });
    expect(script).toContain("patchExplorerSortFn");
    expect(script).toContain("dataFns.sortFn = sortFnSource");
    expect(script).not.toContain("if (!dataFns.sortFn)");
  });

  it("loads orderIndex.json into a global map for sortFn", () => {
    const script = buildExplorerPatchScript({});
    expect(script).toContain("orderIndex.json");
    expect(script).toContain("__sortByOrderMap");
    expect(script).not.toContain("fetchData");
  });

  it("resolves orderIndex.json from site root on nested pages", () => {
    const script = buildExplorerPatchScript({});
    expect(script).toContain("resolveBasePath");
    expect(script).toContain('resolveBasePath("static/orderIndex.json")');
    expect(script).not.toContain('base + "static/orderIndex.json"');
  });

  it("reads order from window.__sortByOrderMap inside sortFn", () => {
    const source = getSortFnSource({});
    expect(source).toContain("__sortByOrderMap");
    expect(source).toContain("node.slug");
  });

  it("prefetches orderIndex.json before DOM is ready", () => {
    const script = buildOrderIndexPrefetchScript();
    expect(script).toContain('fetch("/static/orderIndex.json")');
    expect(script).toContain("__sortByOrderReady");
  });

  it("hides Explorer until the first sorted render completes", () => {
    const script = buildExplorerPatchScript({});
    expect(explorerPendingCss).toContain("sort-by-order-pending");
    expect(script).toContain("sort-by-order-pending");
    expect(script).toContain("gateNavUntilReady");
    expect(script).toContain("revealWhenExplorerRendered");
    expect(script).toContain("stopImmediatePropagation");
  });

  it("does not trigger a second nav from loadOrderIndex", () => {
    const script = buildExplorerPatchScript({});
    const navDispatches = script.match(/dispatchEvent\(new CustomEvent\("nav"/g);
    expect(navDispatches).toHaveLength(1);
  });
});
