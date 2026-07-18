#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { parsePlanMarkdown, validateDeck } from "./lib/card-data.mjs";

const inputArg = process.argv.find((item, index, items) => items[index - 1] === "--input") || process.argv[2];
if (!inputArg) {
  console.log("用法：node scripts/check_plan.mjs --input 拆分方案.md");
  process.exit(1);
}

const inputPath = path.resolve(inputArg);
if (!fs.existsSync(inputPath)) {
  console.error(`[错误] 找不到拆分方案：${inputPath}`);
  process.exit(1);
}

const markdown = fs.readFileSync(inputPath, "utf8");
const deck = parsePlanMarkdown(markdown);
const validation = validateDeck(deck);
const errors = [...validation.errors];
const warnings = [...validation.warnings];

if (!/^## 文章解构\s*$/m.test(markdown)) errors.push("缺少“文章解构”模块。");
if (!/^## 小红书发布文案\s*$/m.test(markdown)) errors.push("缺少“小红书发布文案”模块。");
if (deck.publication.body.length < 80) errors.push("发布正文少于 80 字，无法独立概括原文核心观点。");
if (/这组卡片|顺着卡片|把卡片|卡片主要|本文将|一起来看看|建议收藏|家人们/.test(deck.publication.body)) {
  errors.push("发布正文仍在介绍卡片或使用平台套话，请直接总结原文观点。");
}
if ((deck.publication.body.match(/\p{Extended_Pictographic}/gu) || []).length > 1) {
  warnings.push("发布正文包含多个 emoji；专业内容默认应使用克制的文字表达。");
}

const layoutFamilies = new Set(deck.cards.map((card) => card.layoutId.split(".")[0]));
if (deck.cards.length >= 6 && layoutFamilies.size < 3) warnings.push("6 张以上卡组少于 3 个布局族，视觉表达可能过于单一。");

deck.cards.forEach((card, index) => {
  const label = `第 ${index + 1} 张`;
  if (!card.meta?.purpose) errors.push(`${label}缺少“本卡任务”。`);
  if (!card.meta?.takeaway) errors.push(`${label}缺少“读者看完应理解”。`);
  if (!card.meta?.sourceAnchor) errors.push(`${label}缺少“原文依据”。`);
  const text = JSON.stringify(card.content || {}).replace(/[{}\[\]",:]/g, "");
  if (!["cover", "tail"].includes(card.kind) && text.length < 45) warnings.push(`${label}解释内容偏少，可能只剩关键词。`);
  const bareItems = (card.content?.items || []).filter((item) => item.title && !item.body && item.title.length < 10);
  if (bareItems.length >= 2) warnings.push(`${label}存在多个缺少解释的短要点。`);
});

for (const warning of warnings) console.warn(`[提醒] ${warning}`);
if (errors.length) {
  for (const error of errors) console.error(`[错误] ${error}`);
  process.exit(1);
}
console.log(`[通过] 文章地图、${deck.cards.length} 张逐卡任务、${deck.publication.titles.length} 个发布标题和发布正文均完整。`);
