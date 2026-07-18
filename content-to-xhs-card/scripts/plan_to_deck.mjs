#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { parsePlanMarkdown, validateDeck } from "./lib/card-data.mjs";

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    if (!argv[i].startsWith("--")) continue;
    const key = argv[i].slice(2);
    const next = argv[i + 1];
    args[key] = !next || next.startsWith("--") ? true : next;
    if (args[key] !== true) i += 1;
  }
  return args;
}

const args = parseArgs(process.argv.slice(2));
if (args.help || args.h || !args.input) {
  console.log("用法：node scripts/plan_to_deck.mjs --input 拆分方案.md [--output 卡片数据.json]");
  process.exit(args.input ? 0 : 1);
}

const inputPath = path.resolve(args.input);
if (!fs.existsSync(inputPath)) {
  console.error(`[错误] 找不到拆分方案：${inputPath}`);
  process.exit(1);
}

const parsed = parsePlanMarkdown(fs.readFileSync(inputPath, "utf8"));
const result = validateDeck(parsed);
for (const warning of result.warnings) console.warn(`[提醒] ${warning}`);
if (result.errors.length) {
  for (const error of result.errors) console.error(`[错误] ${error}`);
  process.exit(1);
}

const outputPath = path.resolve(args.output || path.join(path.dirname(inputPath), "卡片数据.json"));
fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, `${JSON.stringify(result.deck, null, 2)}\n`, "utf8");
console.log(`[完成] 已生成卡片数据：${outputPath}`);
console.log(`[检查] 共 ${result.deck.cards.length} 张卡片，结构校验通过。`);
