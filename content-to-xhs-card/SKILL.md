---
name: content-to-xhs-card
description: "把公众号文章、Markdown、笔记、文档或长文本拆成适合小红书/小绿书的完整发布包。先分析全文、论证关系和模块覆盖，输出含完整逐卡文案、布局 ID、3～5 个标题建议与发布正文的确认方案；确认后生成可逐元素编辑、移动、缩放、切换整套或单卡主题、编辑发布文案并导出 1080x1440 PNG 的独立 HTML。也适用于复用已有拆分方案或 v1/v2 卡片 JSON。"
---

# 内容转小红书卡片

## 运行约定

- 将当前 `SKILL.md` 所在目录视为 `SKILL_ROOT`，所有 `scripts/`、`assets/` 和 `references/` 路径都相对它解析。
- 执行脚本时以 `SKILL_ROOT` 为工作目录；用户文章、确认稿和输出目录使用绝对路径，始终留在用户自己的工作区。
- 需要 Node.js 20 或更高版本。日常生成只使用 Node.js 内置能力，只有真实浏览器导出回归需要 Playwright。
- 不上传文章、卡片数据或 API Key，也不要求把任何大模型密钥写入 Skill 目录。

## 必须遵守

1. 默认先确认逐卡内容，用户确认前不生成最终 HTML；用户明确跳过时例外。
2. 卡片必须保留完整论证，不得只放关键词；每张只表达一个主要关系。
3. 每张卡必须能**脱离原文和其他卡独立读懂**:标题给结论、要点给解释、金句给记忆点,三者各司其职,不许互相复读。拆卡前先按 `references/content-quality.md` 建立文章地图,再逐卡设计"一个主张 / 一组支撑 / 一句记忆点"。
4. 先识别信息关系，再选布局。不得为了“看起来丰富”伪造数据、比例或图表。
5. **严禁无意义装饰图形与跨卡重复**:任何图形/SVG 必须承载本卡独有的真实信息;若图内文字可被任意词替换而不影响理解,或多张卡重复同一组图形词,一律删除。`statement.poster` 与 `cover.editorial` 是纯文字版式,不带中心装饰图。
6. 6 张以上的卡组通常至少使用 3 个布局族；相邻卡只有表达相同关系时才重复布局。
7. 所有可见内容都应成为普通可编辑元素。品牌、页码、栏目标签、“核心判断”、图片和 SVG 都允许修改、隐藏或删除；空值不得被强制回填。
8. 默认整套统一使用 `warm-editorial`（热烈撞色）；只有用户明确要求时才在生成阶段保留逐卡配色。HTML 中允许选择“整套”或“单卡”切换主题。不使用绿色作为品牌主色。
9. 默认尾页素材与编辑器左上角品牌入口使用 `assets/brand/qianmian-logo.png`；左上角点击跳转 `https://nextwaylab.com/`。只有用户明确传入 `--qr` 时，尾页才改用二维码。
10. 交付必须包含 3～5 个标题建议和一段基于原文核心观点的专业发布正文，并写入 `deck.publication`。正文必须能脱离卡片独立成立，默认不用 emoji，不得介绍“这组卡片”或使用收藏、互动等平台套话；细则见 `references/publication-copy.md`。

## 工作流

### 1. 紧凑分析

先运行脚本清理占位图、公众号尾部噪声并提取结构：

```bash
node scripts/analyze_article.mjs --input path/to/article.md --output path/to/analysis.compact.json
```

优先读取紧凑分析中的关系类型、核心主张候选和模块覆盖；只有语义不清或需要核对原意时，才回看对应原文段落。再运行确定性初稿：

```bash
node scripts/plan_cards.mjs --input path/to/article.md --output path/to/拆分方案.md --max-cards 10
```

模型按 `references/content-quality.md` 修正文章地图、模块覆盖和逐卡完整表达，并按 `references/publication-copy.md` 修订发布标题与正文，不重写模板代码。

### 2. 输出确认方案

确认稿必须包含：文章核心问题、核心主张、模块覆盖、整体叙事顺序、3～5 个发布标题、发布正文，以及每张卡的任务、读者收获、原文依据、布局和可直接上图的完整文字。表格中明确写布局 ID：

```markdown
| 区域 | 文字 |
| --- | --- |
| 布局 | comparison.split |
| 配色 | warm-editorial |
| 本卡任务 | 解释两类方案为何服务不同目标 |
| 读者看完应理解 | 两类方案不是优劣关系，而是默认服务对象不同 |
| 主标题 | …… |
| 左侧标题 | …… |
| 左侧内容 | 要点一｜解释<br>要点二｜解释 |
| 右侧标题 | …… |
| 右侧内容 | …… |
| 核心判断 | …… |
```

布局选择规则见 `references/layout-catalog.md`。矩阵、数据、对比卡必须提供对应的结构化字段，不得把所有内容都塞进“正文要点”。确认前按 `references/content-quality.md` 做一次“只看卡片能否理解全文”的自检。

### 3. 用户确认后生成

```bash
node scripts/content_to_cards.mjs --input path/to/article.md --plan path/to/拆分方案.md --output path/to/output-dir --brand-name "前面-Aaron" --brand-url "https://nextwaylab.com/"
```

已有 JSON 时直接复用，不再总结原文：

```bash
node scripts/content_to_cards.mjs --deck path/to/卡片数据.json --output path/to/output-dir --brand-name "前面-Aaron" --brand-url "https://nextwaylab.com/"
```

输出包括 `index.html` 和 `卡片数据.json`。v1 JSON 会自动迁移到 v2；用户从 HTML 下载的 v2 JSON 已包含自由布局与替换素材。

### 4. 校验

```bash
node scripts/check_plan.mjs --input path/to/拆分方案.md
node scripts/check_deck.mjs --input path/to/卡片数据.json
node scripts/check_html.mjs --input path/to/index.html
```

浏览器抽查封面、最密卡、含图片/SVG 的卡和尾页；移动、缩放、字号、删除、图片替换、JSON 往返至少各验证一次，并确认 IndexedDB 自动保存、品牌入口、默认尾页素材与 PNG 尺寸正确。

修改导出、图片、SVG、Canvas 或模板代码后，必须再运行真实浏览器导出检查：

```bash
node scripts/browser_export_smoke.cjs --input path/to/index.html --output path/to/export-smoke.png
```

修改批量导出或 ZIP 逻辑时，同时传入 `--zip-output path/to/all-cards.zip`；校验必须确认压缩包内 PNG 数量、文件头和尺寸，而不只是确认 ZIP 被下载。

导出安全要求见 `references/export-safety.md`。不得只凭脚本语法或 HTML 字符串检查判断 PNG 可用。

## HTML 能力

- 卡片：选择布局与暖调主题，增删、复制、排序。
- 配色：默认整套统一；工具栏可在“整套”和“单卡”之间切换作用范围，支持热烈撞色、珊瑚纸张、玫瑰墨色和深夜霓虹。
- 元素：点击画布或图层选中；编辑内容；上下左右移动；拖拽和缩放；调层级；显隐、锁定、复制、删除。
- 字体：普通文字可调字号与最小字号；内容框可分别调标签、标题、正文和列表字号；信息图可按比例调整内部全部文字。
- 素材：图片与 SVG 可替换、清空或删除；便携 JSON 保存 Data URL 素材。
- 信息图：阶段链、闭环、二元轴、矩阵、Bento、排名和数据仪表板由结构化数据生成。
- 发布：独立“发布正文”页签与“卡片 / 元素 / 页面”并列，可编辑、删除和复制 3～5 个标题建议及发布正文。
- 保存：编辑记录优先写入 IndexedDB，并把内置图片替换为资源引用，避免默认素材挤满 `localStorage`；JSON 仍保存完整便携素材。
- 导出：预览与 PNG 使用同一 DOM 场景；默认严格导出 1080×1440，2x 仅作为可选高清版。

## 省 Token 规则

- 普通内容任务禁止读取模板源码、生成后的完整 HTML 或 Base64；只读紧凑分析、确认稿和卡片 JSON。
- 模型只修改不确定的文案或结构字段；解析、布局选择、迁移、校验、HTML 打包和导出交给脚本。
- 用户已在 HTML 修改时，优先使用其下载的 JSON 继续处理。
- 内容分析与拆分才读取 `references/content-quality.md`；生成或修订发布文案才读取 `references/publication-copy.md`；视觉调整才读取 `references/style-guide.md` 与 `references/layout-catalog.md`；数据迁移才读取 `references/card-data-schema.md` 与 `references/editor-data-model.md`；修改导出、图片、SVG 或 Canvas 才读取 `references/export-safety.md`；优化成本才读取 `references/token-optimization.md`。

## 文件路由

- `scripts/analyze_article.mjs`：生成低 token 的紧凑结构分析。
- `scripts/plan_cards.mjs`：生成可人工修订的方案初稿。
- `scripts/plan_to_deck.mjs`：确认稿转 v2 JSON。
- `scripts/check_plan.mjs`：检查文章地图、逐卡任务、解释密度与发布文案。
- `scripts/content_to_cards.mjs`：打包独立 HTML。
- `scripts/check_html.mjs`：静态检查编辑器能力与高风险导出回归。
- `scripts/browser_export_smoke.cjs`：用真实浏览器校验字号、品牌入口、IndexedDB、尾页素材，并点击导出验证 PNG。
- `scripts/lib/layout-registry.mjs`：布局元数据与确定性映射。
- `references/export-safety.md`：PNG、Canvas、图片与 SVG 的导出安全规范。
- `references/content-quality.md`：文章地图、逐卡完整表达与卡组连贯性规范。
- `references/publication-copy.md`：基于原文生成专业标题建议与发布正文的规范。
- `assets/card-template/`：HTML 壳、样式、布局引擎和编辑器；仅在开发编辑器时读取。
