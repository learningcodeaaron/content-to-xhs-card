#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { normalizeDeck, parsePlanMarkdown, validateDeck } from "../content-to-xhs-card/scripts/lib/card-data.mjs";
import { LAYOUTS } from "../content-to-xhs-card/scripts/lib/layout-registry.mjs";

const skillRoot = path.resolve("content-to-xhs-card");
const skillMarkdown = fs.readFileSync(path.join(skillRoot, "SKILL.md"), "utf8");
const frontmatter = skillMarkdown.match(/^---\r?\n([\s\S]*?)\r?\n---/);
assert(frontmatter, "SKILL.md 必须包含 YAML frontmatter");
const frontmatterKeys = [...frontmatter[1].matchAll(/^([a-z][a-z0-9_-]*):/gm)].map((match) => match[1]);
assert.deepEqual(frontmatterKeys, ["name", "description"], "Skill frontmatter 只保留 name 与 description");
assert.match(frontmatter[1], /^name: content-to-xhs-card$/m);
assert(!fs.existsSync(path.join(skillRoot, "README.md")), "可安装 Skill 目录内不应放 README.md");

const legacy = normalizeDeck({
  title: "迁移测试",
  cards: [
    { type: "cover", title: "封面", subtitle: "副标题", quote: "判断" },
    { type: "section", title: "A 与 B 的两类区别", bullets: ["A｜说明", "B｜说明"] },
    { type: "framework", title: "三个步骤", items: ["一", "二", "三"] },
    { type: "tail", title: "最后", quote: "收束", cta: "关注" },
  ],
});
assert.equal(legacy.schemaVersion, 2);
assert.deepEqual(legacy.cards.map((card) => card.layoutId), ["cover.editorial", "comparison.split", "process.timeline", "tail.cta"]);
assert(legacy.cards.every((card) => card.themeId === "warm-editorial"), "未指定配色时必须默认使用热烈撞色");
assert(legacy.publication.titles.length >= 3, "旧卡组迁移后必须补充发布标题建议");
assert(legacy.publication.body.length > 20, "旧卡组迁移后必须补充发布正文");
assert(!/这组卡片|顺着卡片|把卡片|卡片主要/.test(legacy.publication.body), "默认发布正文不能介绍卡片本身");
assert.deepEqual(normalizeDeck(legacy), legacy, "v2 归一化必须保持幂等");

const plan = parsePlanMarkdown(`# 卡片拆分方案：测试

## 文章解构

| 项目 | 内容 |
| --- | --- |
| 核心问题 | A 与 B 有什么不同 |

## 小红书发布文案

| 区域 | 文字 |
| --- | --- |
| 标题建议 | 标题一<br>标题二<br>标题三 |
| 正文 | A 与 B 的差别不只在表面能力，而在于各自承担什么任务、服务什么判断。理解两类方案的责任边界，才能判断何时应追求即时结果，何时应积累长期上下文。选择工具之前，先明确问题、判断责任与期望结果。 |

## 1. 对比卡｜两类选择

| 区域 | 文字 |
| --- | --- |
| 布局 | comparison.split |
| 主标题 | 左侧还是右侧 |
| 左侧标题 | 左侧型 |
| 左侧内容 | 深度信息｜解释逻辑<br>安全边际｜避免买贵 |
| 右侧标题 | 右侧型 |
| 右侧内容 | 趋势确认｜等待共识 |
| 核心判断 | 区别在于谁承担判断责任 |
`);
assert.equal(plan.cards[0].layoutId, "comparison.split");
assert.equal(plan.cards[0].themeId, "warm-editorial");
assert.deepEqual(plan.publication.titles, ["标题一", "标题二", "标题三"]);
assert(plan.publication.body.includes("责任边界"));
assert.equal(plan.cards[0].content.left.items.length, 2);
assert.equal(plan.cards[0].content.right.title, "右侧型");

const validation = validateDeck({ schemaVersion: 2, title: "最小卡组", cards: plan.cards });
assert.equal(validation.errors.length, 0);
assert.equal(new Set(LAYOUTS.map((layout) => layout.id)).size, LAYOUTS.length, "布局 ID 不能重复");

const samplePath = path.resolve("examples/ai-agent-moat/card-data.json");
const sample = JSON.parse(fs.readFileSync(samplePath, "utf8"));
const result = validateDeck(sample);
assert.equal(result.errors.length, 0);
assert.equal(result.deck.cards.length, 10);
assert.equal(result.deck.cards[0].layoutId, "cover.editorial");
assert.equal(result.deck.cards.at(-1).layoutId, "tail.cta");

console.log(`[通过] v2 迁移、确认稿解析、${LAYOUTS.length} 个布局注册项与测试卡组均正常。`);
