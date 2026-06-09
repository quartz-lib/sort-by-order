import { QuartzEmitterPlugin } from '@quartz-community/types';

interface FileTrieNode {
    slugSegment?: string;
    slugSegments?: string[];
    displayName?: string;
    isFolder: boolean;
    data: Record<string, unknown> | null;
    children: FileTrieNode[];
}
interface SortByOrderOptions {
    /** Frontmatter key used for sorting. Default: "order" */
    orderKey?: string;
    /** Keep folders before files when comparing mixed types. Default: true */
    foldersFirst?: boolean;
    /** Where items without an order value are placed. Default: "end" */
    missingOrderPlacement?: "end" | "start";
}
type SortByOrderEmitterOptions = SortByOrderOptions;

/**
 * Writes order metadata and injects Explorer sorting without manual quartz.ts changes.
 *
 * Uses a standalone orderIndex.json because emitters run in parallel with ContentIndex.
 */
declare const SortByOrder: QuartzEmitterPlugin<Partial<SortByOrderEmitterOptions>>;

/**
 * Create a sort function for Quartz Explorer that orders nodes by frontmatter `order`.
 *
 * Requires the SortByOrder emitter to inject `order` into `static/contentIndex.json`.
 */
declare function createSortByOrderFn(userOpts?: SortByOrderOptions): (a: FileTrieNode, b: FileTrieNode) => number;
/** Default Explorer sort function using frontmatter `order`. */
declare const sortByOrderFn: (a: FileTrieNode, b: FileTrieNode) => number;

export { type FileTrieNode, SortByOrder, type SortByOrderEmitterOptions, type SortByOrderOptions, createSortByOrderFn, sortByOrderFn };
