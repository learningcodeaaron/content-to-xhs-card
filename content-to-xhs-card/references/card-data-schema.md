# 卡片数据格式 v2

仅在手写、迁移或排查 JSON 时读取。正常流程优先使用确认版 Markdown 和脚本。

## 紧凑数据

模型和拆分脚本只需要生成语义内容，不需要生成元素坐标：

```json
{
  "schemaVersion": 2,
  "id": "deck-example",
  "title": "整组卡片标题",
  "source": "可选来源",
  "canvas": {"width": 1080, "height": 1440},
  "cards": [{
    "id": "card-01",
    "kind": "comparison",
    "layoutId": "comparison.split",
    "themeId": "warm-editorial",
    "content": {
      "kicker": "栏目",
      "title": "完整标题",
      "lead": "引导句",
      "left": {"title": "A", "items": [{"title": "要点", "body": "解释"}]},
      "right": {"title": "B", "items": [{"title": "要点", "body": "解释"}]},
      "quote": "收束判断"
    }
  }],
  "publication": {
    "titles": ["标题建议一", "标题建议二", "标题建议三"],
    "body": "用于小红书发布的简短正文。"
  }
}
```

常用 `content` 字段：

- 通用：`kicker`、`title`、`subtitle`、`lead`、`quote`、`cta`、`source`。
- 列表/流程/Bento：`items[]`，单项为 `title/body/value`。
- 对比：`left`、`right`，各含 `label/title/body/items[]`。
- 二元轴：`axes[]`，单项为 `left/right/body`。
- 矩阵：`matrix[]`，最多 16 项。
- 数据：`stats[]`，单项使用 `title/value/body`；只有原文存在真实数值时使用。

## 自由编辑数据

HTML 首次打开时会把布局物化为 `elements[]`。用户下载的 JSON 会保留这些元素和替换后的 Data URL 素材：

```json
{
  "id": "text-ab12",
  "type": "text",
  "role": "title",
  "frame": {"x": 64, "y": 140, "width": 952, "height": 260, "rotation": 0},
  "zIndex": 20,
  "visible": true,
  "locked": false,
  "binding": "title",
  "content": {"text": "标题"},
  "style": {"fontSize": 76, "fontWeight": 950, "lineHeight": 1.16}
}
```

元素类型：`text`、`panel`、`image`、`visual`、`shape`。程序化信息图属于 `visual`；用户上传的 SVG 按 `image` 保存。

删除模板元素后，其 `role` 会进入卡片的 `removedRoles[]`。普通切换布局不会复活同名元素；“恢复默认元素”会清空该数组。

## v1 兼容

无 `schemaVersion` 的旧 JSON 会自动迁移：

- `cover` → `cover.editorial`
- `framework` → `process.timeline`
- `takeaways` / `section` → `list.cards`
- `tail` → `tail.cta`

迁移后不再用空值回填已删除内容。中文旧键仍兼容，但新数据统一使用英文键。
