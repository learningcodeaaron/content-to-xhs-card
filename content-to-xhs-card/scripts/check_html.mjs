#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { layoutOptions } from "./lib/layout-registry.mjs";

const inputArg = process.argv.find((item, index, items) => items[index - 1] === "--input") || process.argv[2];
if (!inputArg) {
  console.log("用法：node scripts/check_html.mjs --input path/to/index.html");
  process.exit(1);
}

const inputPath = path.resolve(inputArg);
if (!fs.existsSync(inputPath)) {
  console.error(`[错误] 找不到 HTML：${inputPath}`);
  process.exit(1);
}

const html = fs.readFileSync(inputPath, "utf8");
const required = [
  "内容卡片编辑",
  "导出当前 PNG",
  "layoutRegistry:",
  "function renderScene",
  "function materializeCard",
  "function sceneToCanvas",
  "ZIP_UTF8_FLAG = 0x0800",
  "name: `card-${String(index + 1).padStart(2, \"0\")}.png`",
  "PNG 数量或文件内容不完整",
  "data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}",
  "function exportJson",
  "data-action=\"insert-visual\"",
  "data-action=\"toggle-visible\"",
  "data-resize-handle=\"height\"",
  "data-action=\"resize-step\"",
  "data-style-field=\"minFontSize\"",
  "data-style-field=\"titleFontSize\"",
  "data-font-scale",
  "fontScale: 1.5",
  "labelFontSize: 30",
  "itemFontSize: 30",
  "panel-quote",
  "midnight-neon",
  "id=\"themeAllBtn\"",
  "id=\"themeCurrentBtn\"",
  "data-tab=\"publication\"",
  "data-publication-field=\"body\"",
  "copy-publication-title",
  "indexedDB.open",
  "asset-ref://",
  "id=\"brandIcon\"",
  "https://nextwaylab.com/",
  "theme-coral-paper",
  "overflow-y: auto",
];
const missing = required.filter((marker) => !html.includes(marker));
if (missing.length) {
  console.error(`[错误] HTML 缺少功能标记：${missing.join("、")}`);
  process.exit(1);
}

const leadSizes = [...html.matchAll(/textElement\("lead"[\s\S]{0,260}?fontSize:\s*(\d+)/g)].map((match) => Number(match[1]));
if (!leadSizes.length || leadSizes.some((size) => size !== 30)) {
  console.error(`[错误] text lead 默认字号必须全部为 30，当前检测：${leadSizes.join("、") || "无"}`);
  process.exit(1);
}

if (/URL\.createObjectURL\s*\(\s*new\s+Blob\s*\(\s*\[\s*svg\s*\]/.test(html)) {
  console.error("[错误] 导出 SVG 使用了 Blob URL，可能在 Edge/Chromium 中污染 Canvas；请改用编码后的 Data URL。");
  process.exit(1);
}

const missingLayouts = layoutOptions().map((layout) => layout.id).filter((layoutId) => !html.includes(`"id":"${layoutId}"`));
if (missingLayouts.length) {
  console.error(`[错误] HTML 布局注册表与 Node 不一致：${missingLayouts.join("、")}`);
  process.exit(1);
}

const script = html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
if (!script) {
  console.error("[错误] HTML 中没有找到主脚本。");
  process.exit(1);
}
try {
  new Function(script);
} catch (error) {
  console.error(`[错误] HTML 脚本语法无效：${error.message}`);
  process.exit(1);
}

const sizeMb = (Buffer.byteLength(html) / 1024 / 1024).toFixed(2);
if (!html.includes("width: 1080px") || !html.includes("height: 1440px")) {
  console.error("[错误] HTML 缺少 1080×1440 逻辑画布。 ");
  process.exit(1);
}
console.log(`[通过] HTML 默认字号、quote 自适应、整套/单卡主题、ZIP 兼容标记、发布文案、品牌入口、IndexedDB 与同源导出标记完整，脚本语法有效，文件大小 ${sizeMb} MB。`);
