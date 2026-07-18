# PNG 导出安全规范

仅在修改导出、图片、SVG、Canvas 或素材持久化时读取。

## 单一视觉源

预览与 PNG 必须来自同一个 1080×1440 DOM 场景。Canvas 只负责栅格化和下载，不得重新实现卡片排版。

## 禁止 Canvas 跨源污染

浏览器一旦把 Canvas 标记为 tainted，`toBlob()` 和 `toDataURL()` 会抛出安全异常，页面将无法下载 PNG。必须遵守：

1. 图片和用户 SVG 在进入卡片前转为 Data URL；不把外链 URL 直接画进 Canvas。
2. 用户 SVG 要移除脚本、事件属性、`foreignObject` 和外链 `href`。
3. DOM 克隆生成的 SVG 必须使用 `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}` 加载后再 `drawImage()`。
4. 不得把包含 `foreignObject` 或内嵌图片的导出 SVG 改成 Blob URL；该路径在 Edge/Chromium 中可能导致 Canvas 污染。
5. 导出前等待 `document.fonts.ready` 和所有图片完成 `decode()`。
6. 导出克隆必须移除选择框和缩放手柄。

## 双层校验

静态检查：

```bash
node scripts/check_html.mjs --input path/to/index.html
```

真实浏览器检查：

```bash
node scripts/browser_export_smoke.cjs --input path/to/index.html --output path/to/export-smoke.png
```

真实检查必须触发页面内的“导出当前 PNG”，并验证：

- 没有出现 `Tainted canvases may not be exported` 或其他导出弹窗。
- 下载事件真实发生。
- PNG 文件头有效，默认尺寸严格为 1080×1440。
- 文件不是明显的空白小文件。
- 页面没有脚本错误。

修改“导出全部 ZIP”或 ZIP 文件名时，还必须传入 `--zip-output path/to/all-cards.zip`，真实点击“导出全部 ZIP”并验证：

- ZIP 条目数量与卡片数量一致，不能只验证 ZIP 文件成功下载。
- 每个条目都是有效 PNG，默认尺寸均为 1080×1440。
- ZIP 内图片统一使用根目录下的 `card-01.png`、`card-02.png` 等 ASCII 名称。
- ZIP 本地文件头与中央目录都写入 UTF-8 标志，确保 Windows 资源管理器和常见解压软件兼容。
- ZIP 能被系统解压工具实际展开；不能只检查文件扩展名或 ZIP 文件头。

该脚本同时检查普通文字、内容框与信息图的字号控件、品牌入口、默认尾页品牌图，以及自动保存是否写入去重后的 IndexedDB 快照。

仅检查 HTML 字符串或 JavaScript 语法不能替代浏览器导出测试。
