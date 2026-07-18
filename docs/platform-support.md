# 平台支持与手动适配

`content-to-xhs-card` 的核心是一个 `SKILL.md`、确定性 Node.js 脚本和静态编辑器资源。它不绑定某一家模型，但不同 AI 客户端加载 Skill 的方式不同。

| 平台 | 支持方式 | 推荐安装位置 |
| --- | --- | --- |
| Codex | 原生 Skill | `~/.codex/skills/content-to-xhs-card` |
| Claude Code | 原生 Agent Skill | `~/.claude/skills/content-to-xhs-card` |
| Cursor | Rules / `AGENTS.md` 适配 | 项目根目录 `AGENTS.md` 或 `.cursor/rules/` |
| 其他本地 AI 工具 | 手动引用 | 让工具读取 `SKILL.md` 并允许执行 Node.js 命令 |

## Codex

```bash
node tools/install-skill.mjs --target codex
```

安装后重启 Codex。用户文章不需要复制进 Skill 目录，直接向 AI 提供文章的绝对路径即可。

## Claude Code

```bash
node tools/install-skill.mjs --target claude
```

Claude Code 的官方文档将个人 Skill 放在 `~/.claude/skills/<skill-name>/SKILL.md`，也支持项目目录下的 `.claude/skills/`。本仓库的安装器默认使用个人目录。

参考：[Claude Code Skills 文档](https://code.claude.com/docs/en/slash-commands)

## Cursor

Cursor 当前主要通过 Project Rules、User Rules 和 `AGENTS.md` 提供长期指令。将 [AGENTS.snippet.md](../adapters/cursor/AGENTS.snippet.md) 的内容合并到目标项目的 `AGENTS.md`，并把其中的 `<REPO_ROOT>` 改成此仓库的绝对路径。

这属于规则适配，不应描述为 Cursor 原生安装 Skill。

参考：[Cursor Rules 文档](https://docs.cursor.com/context/rules-for-ai)

## 其他 AI 工具

满足下面三个条件时通常可以手动接入：

1. 能读取本地 Markdown 和 JSON 文件。
2. 能执行 Node.js 20 或更高版本的命令。
3. 能遵守“先确认逐卡方案，再生成最终 HTML”的两阶段流程。

如果工具只能聊天、不能读文件或执行命令，可以把它用于内容拆分，但无法完整生成和验证可编辑 HTML。

## 数据边界

Skill 本身没有后端，也不会主动联网上传文章。模型实际如何读取和处理文章，仍由用户所选 AI 客户端决定。涉及客户数据、内部资料或个人信息时，应先确认客户端的数据保留和隐私政策。
