# Content to XHS Card

把公众号文章、Markdown、笔记或长文本整理成完整的小红书/小绿书发布包：先确认逐卡文案，再生成可编辑 HTML、卡片 JSON、标题建议、发布正文和 1080×1440 PNG。

整个流程在用户自己的 AI 与本地工作目录中运行。这个项目不提供文章上传服务，也不收集大模型 API Key。

- 产品介绍：[nextwaylab.com/tools/xhs-card](https://nextwaylab.com/tools/xhs-card)
- 可编辑示例：[nextwaylab.com/tools/xhs-card-demo/index.html](https://nextwaylab.com/tools/xhs-card-demo/index.html)
- 示例文章：[AI Agent 公司到底有没有护城河？](https://mp.weixin.qq.com/s/yvb61dMes3nVX4VXEQRYRQ)

![AI Agent 护城河示例封面](examples/ai-agent-moat/cards/card-01.png)

## 能力

- 先分析文章地图、论证关系和模块覆盖，再生成确认方案。
- 每张卡片保留完整解释，不只堆关键词。
- 内置 14 个布局和 4 套主题，支持整套或单卡切换。
- 逐元素编辑文字、位置、字号、层级、图片与 SVG。
- 编辑记录写入浏览器 IndexedDB，支持 JSON 往返。
- 导出单张 PNG 或整套 ZIP，并附带 3～5 个标题建议和发布正文。
- 默认 IP 人像和“前面-Aaron”仅作为演示起点，可替换为自己的 IP 人像、品牌名称、品牌图标与品牌网址。

## 品牌自定义

生成时可以根据自己的品牌调整默认素材，不必保留示例中的人物或“前面-Aaron”名称：

```bash
node content-to-xhs-card/scripts/content_to_cards.mjs \
  --deck path/to/card-data.json \
  --output path/to/output-dir \
  --brand-name "你的品牌名称" \
  --brand-url "https://example.com/" \
  --avatar path/to/your-ip.png \
  --brand-icon path/to/your-logo.png
```

- `--avatar`：替换封面等位置使用的默认 IP 人像。
- `--brand-name`：替换卡片和编辑器中的默认品牌名称。
- `--brand-icon`：替换左上角品牌入口与默认尾页使用的品牌图标。
- `--brand-url`：替换点击品牌入口后打开的网址。
- `--qr`：需要时可另外传入二维码图片，让尾页使用二维码。

生成后的 HTML 仍可继续编辑文字、图片和页面元素；参数只是设置一套更贴近自己品牌的初始状态。

## 环境要求

- Node.js 20 或更高版本。
- 一个能读取本地文件并执行 Node.js 命令的 AI 客户端。
- 只有运行真实浏览器导出回归时才需要安装 Playwright；日常使用不需要安装 npm 依赖。

## 安装

克隆仓库：

```bash
git clone https://github.com/learningcodeaaron/content-to-xhs-card.git
cd content-to-xhs-card
```

### Codex

```bash
node tools/install-skill.mjs --target codex
```

安装到 `~/.codex/skills/content-to-xhs-card`。重新打开 Codex 后即可使用。

### Claude Code

```bash
node tools/install-skill.mjs --target claude
```

安装到 `~/.claude/skills/content-to-xhs-card`。Claude Code 官方支持个人目录与项目目录中的 Agent Skills。

### Cursor 和其他 AI 工具

Cursor 当前使用 Rules/`AGENTS.md`，不是原生 Skill 目录。请参考 [平台支持与手动适配](docs/platform-support.md)，使用仓库提供的 [AGENTS.md 片段](adapters/cursor/AGENTS.snippet.md)。

## 使用

安装后，在支持的 AI 客户端中提供文章文件并描述任务，例如：

```text
请使用 content-to-xhs-card，把这篇 Markdown 整理成 8～10 张小红书卡片。
先给我确认方案，我确认后再生成可编辑 HTML。
```

Skill 会把自己的安装目录视为 `SKILL_ROOT`，脚本从该目录执行；文章和输出始终保留在用户工作区。

## 示例

`examples/ai-agent-moat/` 包含：

- 已获授权的示例文章 Markdown。
- v2 卡片数据。
- 可离线打开的编辑器 HTML。
- 10 张 1080×1440 PNG 成品。
- 一段无配音 WebM 操作演示。

## 开发验证

```bash
npm install
npm test
npm run test:example
npm run test:browser
```

`test:browser` 会启动本地临时服务，使用真实 Chromium 操作编辑器并验证 PNG 导出。

## 隐私边界

- 仓库没有后端服务，也不会上传文章或卡片数据。
- Skill 不要求用户把 API Key 写入任何文件。
- 模型调用的数据处理方式由用户所选 AI 客户端决定，请同时查看该客户端的隐私政策。
- 不要把包含个人信息、客户资料或内部数据的输出提交到公开仓库。

## License

[MIT](LICENSE)
