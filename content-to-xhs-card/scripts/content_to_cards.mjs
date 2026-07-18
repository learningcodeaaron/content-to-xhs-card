#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parsePlanMarkdown, validateDeck } from "./lib/card-data.mjs";
import { layoutOptions } from "./lib/layout-registry.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const skillRoot = path.resolve(__dirname, "..");

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith("--")) continue;
    const key = token.slice(2);
    const next = argv[i + 1];
    args[key] = !next || next.startsWith("--") ? true : next;
    if (args[key] !== true) i += 1;
  }
  return args;
}

function usage() {
  return [
    "用法：",
    "  node scripts/content_to_cards.mjs --input article.md --output output-dir [options]",
    "  node scripts/content_to_cards.mjs --plan 拆分方案.md --output output-dir [options]",
    "",
    "参数：",
    "  --brand-name \"前面-Aaron\"",
    "  --brand-url https://nextwaylab.com/",
    "  --platform xhs|greenbook|square",
    "  --style warm-editorial|coral-paper|rose-ink|midnight-neon",
    "  --preserve-card-themes（保留 JSON 中逐卡配色；默认整套统一）",
    "  --max-cards 10",
    "  --plan path/to/确认版拆分方案.md",
    "  --deck path/to/卡片数据.json",
    "  --deck-output path/to/卡片数据.json",
    "  --embed-source",
    "  --avatar path/to/avatar.png",
    "  --brand-icon path/to/logo.png",
    "  --qr path/to/qr.jpg（不传则尾页使用品牌 IP 图）",
  ].join("\n");
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function readUtf8(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

function mimeFor(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".png") return "image/png";
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".webp") return "image/webp";
  if (ext === ".svg") return "image/svg+xml";
  return "application/octet-stream";
}

function dataUri(filePath) {
  if (!filePath) return "";
  const resolved = path.resolve(filePath);
  if (!fs.existsSync(resolved)) return "";
  const data = fs.readFileSync(resolved).toString("base64");
  return `data:${mimeFor(resolved)};base64,${data}`;
}

function resolveAsset(userValue, fallbackName) {
  if (userValue) return path.resolve(userValue);
  return path.join(skillRoot, "assets", "brand", fallbackName);
}

function outputPathFrom(value) {
  const out = path.resolve(value || "output/xhs-cards");
  if (path.extname(out).toLowerCase() === ".html") {
    ensureDir(path.dirname(out));
    return out;
  }
  ensureDir(out);
  return path.join(out, "index.html");
}

function safeJson(value) {
  return JSON.stringify(value)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

function inject(template, placeholder, value) {
  if (!template.includes(placeholder)) throw new Error(`模板缺少注入占位：${placeholder}`);
  return template.replace(placeholder, value);
}

function readJson(filePath, label) {
  try {
    return JSON.parse(readUtf8(filePath));
  } catch (error) {
    throw new Error(`${label}无法解析：${error.message}`);
  }
}

const args = parseArgs(process.argv.slice(2));

if (args.help || args.h) {
  console.log(usage());
  process.exit(0);
}

if (args.plan && args.deck) {
  console.error("[错误] --plan 和 --deck 只能选择一个。");
  process.exit(1);
}

if (!args.input && !args.plan && !args.deck) {
  console.error("[错误] 至少需要 --input、--plan 或 --deck 之一。");
  console.error(usage());
  process.exit(1);
}

const inputPath = args.input ? path.resolve(args.input) : "";
const planPath = args.plan ? path.resolve(args.plan) : "";
const deckPath = args.deck ? path.resolve(args.deck) : "";
for (const [label, filePath] of [["输入文件", inputPath], ["拆分方案", planPath], ["卡片数据", deckPath]]) {
  if (filePath && !fs.existsSync(filePath)) {
    console.error(`[错误] 找不到${label}：${filePath}`);
    process.exit(1);
  }
}

const templatePath = path.join(skillRoot, "assets", "card-template", "index.html");
const editorCssPath = path.join(skillRoot, "assets", "card-template", "editor.css");
const layoutEnginePath = path.join(skillRoot, "assets", "card-template", "layout-engine.js");
const editorJsPath = path.join(skillRoot, "assets", "card-template", "editor.js");
for (const filePath of [templatePath, editorCssPath, layoutEnginePath, editorJsPath]) {
  if (!fs.existsSync(filePath)) {
    console.error(`[错误] 找不到模板文件：${filePath}`);
    process.exit(1);
  }
}

const markdown = inputPath ? readUtf8(inputPath) : "";
const template = readUtf8(templatePath);
const outputFile = outputPathFrom(args.output);

let rawDeck = null;
try {
  if (planPath) rawDeck = parsePlanMarkdown(readUtf8(planPath));
  if (deckPath) rawDeck = readJson(deckPath, "卡片数据");
} catch (error) {
  console.error(`[错误] ${error.message}`);
  process.exit(1);
}

const validation = rawDeck ? validateDeck(rawDeck) : { deck: null, errors: [], warnings: [] };
for (const warning of validation.warnings) console.warn(`[提醒] ${warning}`);
if (validation.errors.length) {
  for (const error of validation.errors) console.error(`[错误] ${error}`);
  process.exit(1);
}

const style = args.style || "warm-editorial";
const deck = validation.deck ? JSON.parse(JSON.stringify(validation.deck)) : null;
if (deck && !args["preserve-card-themes"]) deck.cards.forEach((card) => { card.themeId = style; });
const maxCards = Math.max(4, Math.min(16, Number.parseInt(args["max-cards"] || "10", 10)));
const brandUrl = args["brand-url"] || "https://nextwaylab.com/";
try {
  const parsedBrandUrl = new URL(brandUrl);
  if (!(["http:", "https:"].includes(parsedBrandUrl.protocol))) throw new Error("unsupported protocol");
} catch {
  console.error(`[错误] --brand-url 只接受有效的 HTTP(S) 地址：${brandUrl}`);
  process.exit(1);
}
const config = {
  brandName: args["brand-name"] || "前面-Aaron",
  brandUrl,
  platform: args.platform || "xhs",
  style,
  tailAsset: args.qr ? "qr" : "brandIcon",
  maxCards,
  sourceFile: inputPath,
  planFile: planPath,
  deckFile: deckPath,
  generatedAt: new Date().toISOString(),
};

const assets = {
  avatar: dataUri(resolveAsset(args.avatar, "cover-avatar-warm.png")),
  brandIcon: dataUri(resolveAsset(args["brand-icon"], "qianmian-logo.png")),
  qr: args.qr ? dataUri(path.resolve(args.qr)) : "",
};

const embeddedMarkdown = deck && !args["embed-source"] ? "" : markdown;
let html = template;
html = inject(html, "/*__EDITOR_CSS__*/", readUtf8(editorCssPath));
html = inject(html, "/*__LAYOUT_ENGINE_JS__*/", readUtf8(layoutEnginePath));
html = inject(html, "/*__EDITOR_JS__*/", readUtf8(editorJsPath));
html = inject(html, "markdown: \"\",", `markdown: ${safeJson(embeddedMarkdown)},`);
html = inject(html, "deck: null,", `deck: ${safeJson(deck)},`);
html = inject(html, "config: {},", `config: ${safeJson(config)},`);
html = inject(html, "assets: {},", `assets: ${safeJson(assets)},`);
html = inject(html, "layoutRegistry: []", `layoutRegistry: ${safeJson(layoutOptions())}`);
fs.writeFileSync(outputFile, html, "utf8");

const deckOutput = args["deck-output"]
  ? path.resolve(args["deck-output"])
  : (planPath ? path.join(path.dirname(outputFile), "卡片数据.json") : "");
if (deckOutput && deck) {
  ensureDir(path.dirname(deckOutput));
  fs.writeFileSync(deckOutput, `${JSON.stringify(deck, null, 2)}\n`, "utf8");
  console.log(`[完成] 已生成卡片数据：${deckOutput}`);
}

console.log(`[完成] 已生成 HTML：${outputFile}`);
console.log("[提示] 可在左侧修改文案，右侧会实时预览；确认后再导出 PNG。");
