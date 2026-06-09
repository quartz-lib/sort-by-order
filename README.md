# Sort By Order

Quartz v5 的 Emitter 插件，让 Explorer 侧边栏中的文档和目录按 frontmatter 的 `order` 字段排序。

Quartz 默认按字母顺序排列 Explorer 中的文件和文件夹。本插件在构建时将 `order` 注入 `static/contentIndex.json`，并提供配套的 `sortFn`，无需手动修改 ContentIndex 或 Explorer 源码。

仓库地址：[github.com/quartz-lib/sort-by-order](https://github.com/quartz-lib/sort-by-order)

## 功能

- 按 frontmatter `order` 数值升序排列文档和目录
- 支持在 `folder/index.md` 中设置文件夹排序
- 未设置 `order` 的项默认排在末尾，并回退到字母序
- 可选「文件夹优先」或「文件夹与文件混合排序」
- 支持自定义 frontmatter 字段名（如 `noteOrder`、`folderOrder`）

## 要求

- [Quartz](https://quartz.jzhao.xyz/) v5.0.0 及以上
- Node.js >= 22
- 已启用 [ContentIndex](https://github.com/quartz-community/content-index) 与 [Explorer](https://github.com/quartz-community/explorer) 插件

> [!note]
> Explorer 的 `sortFn` 是 JavaScript 函数，无法通过 YAML 配置。启用本插件后，还需在 `quartz.ts` 中传入 `sortByOrderFn`，排序才会生效。详见下方 [配置 Explorer](#配置-explorer)。

## 安装

在你的 Quartz 站点根目录执行：

```bash
npx quartz plugin add github:quartz-lib/sort-by-order
```

CLI 会自动将插件写入 `quartz.config.yaml` 和 `quartz.lock.json`。

## 配置

安装后，`quartz.config.yaml` 中会出现类似配置：

```yaml
plugins:
  - source: github:quartz-lib/sort-by-order
    enabled: true
    options:
      orderKey: order
```

### 选项说明

| 选项 | 类型 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `orderKey` | `string` | `"order"` | frontmatter 中用于排序的字段名 |

以下选项用于 `createSortByOrderFn()`，需在 `quartz.ts` 中配置：

| 选项 | 类型 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `foldersFirst` | `boolean` | `true` | 为 `true` 时文件夹排在文件前面 |
| `missingOrderPlacement` | `"end" \| "start"` | `"end"` | 未设置 `order` 的项排在末尾或开头 |

### 在 Markdown 中设置 order

文档排序：

```markdown
---
title: 第一章
order: 1
---
```

目录排序需在 `folder/index.md` 中设置：

```markdown
---
title: 指南
order: 2
---
```

### 配置 Explorer

在 `quartz.ts` 中为 Explorer 传入排序函数：

```ts
import { loadQuartzConfig, loadQuartzLayout } from "./quartz/plugins/loader/config-loader"
import * as Plugin from "./.quartz/plugins"
import { sortByOrderFn } from "@quartz-community/sort-by-order"

const config = await loadQuartzConfig()
export default config

export const layout = await loadQuartzLayout({
  byPageType: {
    content: {
      left: [
        Plugin.Explorer({
          sortFn: sortByOrderFn,
        }),
      ],
    },
  },
})
```

### 示例：文件夹与文件混合排序

适用于希望目录和笔记按同一套 `order` 混排的场景：

```ts
import { createSortByOrderFn } from "@quartz-community/sort-by-order"

const sortFn = createSortByOrderFn({
  foldersFirst: false,
  missingOrderPlacement: "end",
})

Plugin.Explorer({ sortFn })
```

### 示例：自定义 frontmatter 字段

```yaml
plugins:
  - source: github:quartz-lib/sort-by-order
    enabled: true
    options:
      orderKey: noteOrder
```

```ts
import { createSortByOrderFn } from "@quartz-community/sort-by-order"

const sortFn = createSortByOrderFn({ orderKey: "noteOrder" })
```

> [!tip]
> `order` 支持数字或数字字符串（如 `"10"`）。`order` 相同时，会按显示名称字母序作为次要排序。

## 在 quartz.ts 中使用

如需在 TypeScript 配置中手动注册 Emitter：

```ts
import * as Plugin from "./.quartz/plugins"

export default {
  plugins: {
    emitters: [
      Plugin.SortByOrder({
        orderKey: "order",
      }),
    ],
  },
}
```

## 工作原理

插件分两步完成排序：

1. **Emitter（`SortByOrder`）**：在 ContentIndex（`defaultOrder: 50`）生成 `static/contentIndex.json` 之后运行（`defaultOrder: 60`），从每篇文档的 frontmatter 读取 `order`，写入对应索引条目。
2. **排序函数（`sortByOrderFn`）**：Explorer 在客户端从 `contentIndex.json` 构建文件树时，通过 `sortFn` 比较各节点的 `data.order` 完成排序。

> [!note]
> ContentIndex 默认不包含 frontmatter 字段。Explorer 在浏览器端运行，无法直接访问构建时的 frontmatter，因此需要本插件先将 `order` 注入索引文件。

默认模式下，同层级的文件夹排在文件前面；关闭 `foldersFirst` 后，文件夹和文件按 `order` 统一排序。

## 开发

```bash
git clone git@github.com:quartz-lib/sort-by-order.git
cd sort-by-order
npm install
npm run build
npm test
```

常用命令：

| 命令 | 说明 |
| --- | --- |
| `npm run build` | 构建并输出到 `dist/` |
| `npm run dev` | 监听模式构建 |
| `npm test` | 运行 Vitest 测试 |
| `npm run check` | 类型检查与测试 |

> [!important]
> `dist/` 目录需要提交到仓库。Quartz 安装插件时优先使用预构建产物，可跳过本地编译，安装更快。

## 相关文档

- [Explorer](https://quartz.jzhao.xyz/features/explorer) — Explorer 组件与 `sortFn` 配置
- [Making your own plugins](https://quartz.jzhao.xyz/advanced/making-plugins) — Quartz 插件类型与生命周期
- [Creating Component Plugins](https://quartz.jzhao.xyz/advanced/creating-components) — Component 插件（本插件为 Emitter，与此不同）
