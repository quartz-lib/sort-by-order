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
import { buildExplorerPatchScript } from "./clientScript.js";
import type { SortByOrderEmitterOptions } from "./types.js";

const defaultOptions: Required<SortByOrderEmitterOptions> = {
  orderKey: "order",
  foldersFirst: true,
  missingOrderPlacement: "end",
};

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

async function emitOrderIndex(
  ctx: BuildCtx,
  content: ProcessedContent[],
  orderKey: string,
): Promise<FilePath[]> {
  const orderBySlug = buildOrderMap(content, orderKey);
  const indexPath = joinSegments(ctx.argv.output, "static/orderIndex.json") as FilePath;

  await fs.mkdir(path.dirname(indexPath), { recursive: true });
  await fs.writeFile(indexPath, JSON.stringify(Object.fromEntries(orderBySlug)));

  return [indexPath];
}

/**
 * Writes order metadata and injects Explorer sorting without manual quartz.ts changes.
 *
 * Uses a standalone orderIndex.json because emitters run in parallel with ContentIndex.
 */
export const SortByOrder: QuartzEmitterPlugin<Partial<SortByOrderEmitterOptions>> = (
  userOpts,
) => {
  const options = { ...defaultOptions, ...userOpts };

  const emit = async (ctx: BuildCtx, content: ProcessedContent[]) => {
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
          spaPreserve: true,
        },
      ],
    }),
  };
};
