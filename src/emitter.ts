import path from "node:path";
import fs from "node:fs/promises";
import type {
  BuildCtx,
  FilePath,
  FullSlug,
  ProcessedContent,
  QuartzEmitterPlugin,
  QuartzPluginData,
} from "@quartz-community/types";
import { joinSegments } from "@quartz-community/types";
import type { SortByOrderEmitterOptions } from "./types.js";

const defaultOptions: Required<SortByOrderEmitterOptions> = {
  orderKey: "order",
};

type ContentIndexEntry = Record<string, unknown> & { order?: number };
type ContentIndexJson = Record<string, ContentIndexEntry>;

function parseOrder(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return undefined;
}

function buildOrderMap(
  content: ProcessedContent[],
  orderKey: string,
): Map<FullSlug, number> {
  const orderBySlug = new Map<FullSlug, number>();

  for (const [, file] of content) {
    const data = (file.data ?? {}) as QuartzPluginData & Record<string, unknown>;
    if (data.unlisted === true) continue;

    const slug = data.slug as FullSlug | undefined;
    if (!slug) continue;

    const frontmatter = (data.frontmatter ?? {}) as Record<string, unknown>;
    const order = parseOrder(frontmatter[orderKey]);
    if (order !== undefined) {
      orderBySlug.set(slug, order);
    }
  }

  return orderBySlug;
}

async function augmentContentIndex(
  ctx: BuildCtx,
  content: ProcessedContent[],
  orderKey: string,
): Promise<FilePath[]> {
  const indexPath = joinSegments(ctx.argv.output, "static/contentIndex.json") as FilePath;

  let index: ContentIndexJson;
  try {
    index = JSON.parse(await fs.readFile(indexPath, "utf-8")) as ContentIndexJson;
  } catch {
    return [];
  }

  const orderBySlug = buildOrderMap(content, orderKey);

  for (const [slug, entry] of Object.entries(index)) {
    const order = orderBySlug.get(slug as FullSlug);
    if (order !== undefined) {
      entry.order = order;
    } else {
      delete entry.order;
    }
  }

  await fs.mkdir(path.dirname(indexPath), { recursive: true });
  await fs.writeFile(indexPath, JSON.stringify(index));
  return [indexPath];
}

/**
 * Injects `order` from frontmatter into `static/contentIndex.json`.
 *
 * Run after the ContentIndex emitter so Explorer can sort client-side.
 */
export const SortByOrder: QuartzEmitterPlugin<Partial<SortByOrderEmitterOptions>> = (
  userOpts,
) => {
  const options = { ...defaultOptions, ...userOpts };

  const emit = async (ctx: BuildCtx, content: ProcessedContent[]) => {
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
    },
  };
};
