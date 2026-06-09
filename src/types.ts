export interface FileTrieNode {
  slugSegment?: string;
  slugSegments?: string[];
  displayName?: string;
  isFolder: boolean;
  data: Record<string, unknown> | null;
  children: FileTrieNode[];
}

export interface SortByOrderOptions {
  /** Frontmatter key used for sorting. Default: "order" */
  orderKey?: string;
  /** Keep folders before files when comparing mixed types. Default: true */
  foldersFirst?: boolean;
  /** Where items without an order value are placed. Default: "end" */
  missingOrderPlacement?: "end" | "start";
}

export interface SortByOrderEmitterOptions {
  orderKey?: string;
}
