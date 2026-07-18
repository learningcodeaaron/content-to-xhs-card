#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { validateDeck } from "./lib/card-data.mjs";

const inputArg = process.argv.find((item, index, items) => items[index - 1] === "--input") || process.argv[2];
if (!inputArg) {
  console.log("用法：node scripts/check_deck.mjs --input 卡片数据.json");
  process.exit(1);
}

const inputPath = path.resolve(inputArg);
if (!fs.existsSync(inputPath)) {
  console.error(`[错误] 找不到卡片数据：${inputPath}`);
  process.exit(1);
}

let raw;
try {
  raw = JSON.parse(fs.readFileSync(inputPath, "utf8"));
} catch (error) {
  console.error(`[错误] JSON 无法解析：${error.message}`);
  process.exit(1);
}

const result = validateDeck(raw);
for (const warning of result.warnings) console.warn(`[提醒] ${warning}`);
if (result.errors.length) {
  for (const error of result.errors) console.error(`[错误] ${error}`);
  process.exit(1);
}

// 内容质检:拦截无意义装饰词与跨卡重复图形(见 references/content-quality.md)。
const PLACEHOLDER_WORDS = ["输入", "理解", "行动", "结构", "内容", "核心", "要点一", "要点二", "占位"];
const qualityIssues = [];
const conceptSignatures = new Map();
for (const [i, card] of result.deck.cards.entries()) {
  const label = `第 ${i + 1} 张(${card.layoutId || card.kind || "?"})`;
  const collectItems = (arr) => (Array.isArray(arr) ? arr : []).map((it) => String(it?.title || "").trim()).filter(Boolean);
  const c = card.content || {};
  const itemTitles = [
    ...collectItems(c.items),
    ...collectItems(c.left?.items), ...collectItems(c.right?.items),
    ...collectItems(c.axes), ...collectItems(c.matrix), ...collectItems(c.stats)
  ];
  // 单卡:成组的短占位词(如 输入/理解/行动)
  const placeholderHits = itemTitles.filter((t) => t.length <= 4 && PLACEHOLDER_WORDS.includes(t));
  if (placeholderHits.length >= 2) {
    qualityIssues.push(`${label} 疑似装饰性占位词:${placeholderHits.join("、")};图形须承载真实信息。`);
  }
  // 跨卡:相同的图形词组合重复出现
  if (itemTitles.length >= 2 && itemTitles.length <= 5 && itemTitles.every((t) => t.length <= 5)) {
    const sig = [...itemTitles].sort().join("|");
    if (conceptSignatures.has(sig)) {
      qualityIssues.push(`${label} 与第 ${conceptSignatures.get(sig) + 1} 张出现重复图形词组「${itemTitles.join("/")}」;每卡主视觉须独有。`);
    } else {
      conceptSignatures.set(sig, i);
    }
  }
}
for (const issue of qualityIssues) console.warn(`[质检] ${issue}`);

console.log(`[通过] ${result.deck.cards.length} 张卡片，结构与必填内容完整。`);
