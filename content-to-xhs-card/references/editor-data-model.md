# 编辑器数据与交互约定

## 单一视觉源

预览与 PNG 导出必须来自同一个 1080×1440 DOM 场景。禁止再为 Canvas 手写一套卡片坐标。导出只负责等待字体/图片、克隆场景、栅格化和下载。

## 元素规则

- 所有可见文字都必须是 `text` 或 `panel` 内容，包括品牌、页码、栏目和“核心判断”。
- 图片和用户上传 SVG 使用 `image`；程序化关系图使用 `visual`；背景块使用 `shape`。
- `visible=false` 同时隐藏预览和导出；`locked=true` 只禁止画布拖动；删除会真正移除元素。
- 坐标永远使用 1080×1440 逻辑像素，预览只缩放外层。
- `zIndex` 与图层顺序一致；移动、缩放和层级调整后写回 JSON。
- 画布提供宽度、高度和右下角三个缩放手柄；属性面板提供 X/Y/宽度/高度、8px 移动按钮和宽高步进按钮；方向键移动 1px，Shift+方向键移动 10px。
- `text` 使用 `fontSize` 与 `minFontSize`，`lead` 默认 30；`panel` 使用 `labelFontSize`、`titleFontSize`、`bodyFontSize`、`itemFontSize`，标签和列表默认 30；`visual` 使用 `fontScale`（0.6～1.8），默认 1.5。
- `quote` panel 使用 `panel-quote` 标记，布局必须预留足够高度；渲染时允许把正文从 30 逐步缩到 22，并在最后降低内边距，不能直接截断。

## 模板与自由布局

布局是元素工厂。首次打开、迁移或用户选择“重新排版”时，布局被物化为完整 `elements[]`。用户编辑后元素数组成为视觉主数据；`content` 只保留语义字段，用于跨布局重排。

删除角色会写入 `removedRoles[]`，避免切换布局时意外复活。只有用户主动选择“恢复默认元素”才清空删除记录。

## 素材

替换图片或 SVG 时读取为 Data URL，随下载 JSON 便携保存。SVG 在 `<img>` 图像上下文中使用，不执行脚本；不得把外链资源直接画入导出 Canvas。大素材会增大便携 JSON，但不应因为内置素材触发浏览器存储不足。

## 自动保存

自动保存优先使用 IndexedDB。历史记录与自动保存快照不重复保存内置 Data URL，而是写入 `asset-ref://<name>`；恢复时再从当前 HTML 的 `BOOTSTRAP.assets` 解析。用户下载的便携 JSON 必须保留完整 Data URL，不能写资源引用。

`localStorage` 只作为 IndexedDB 不可用时的小体积回退，不得再次作为大图片卡组的主存储。

## 卡组主题与发布信息

`themeScope` 只属于编辑器状态：`all` 表示主题选择应用到全部卡片，`current` 表示只修改当前卡。生成后的持久数据仍以每张卡的 `themeId` 为准。

`deck.publication` 保存 `{ titles: string[], body: string }`，并在独立“发布正文”页签中编辑。标题建议允许增删、编辑与复制；正文允许编辑与复制，并随自动保存及便携 JSON 一起保留。“页面”页签不再承载发布文案。

修改图片、SVG、Canvas 或 PNG 导出链路时，必须读取 `references/export-safety.md`，并同时运行静态检查与真实浏览器导出检查。
