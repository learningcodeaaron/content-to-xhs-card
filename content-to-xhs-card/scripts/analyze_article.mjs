#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) continue;
    const key = token.slice(2);
    const next = argv[index + 1];
    args[key] = !next || next.startsWith("--") ? true : next;
    if (args[key] !== true) index += 1;
  }
  return args;
}

function cleanInline(value) {
  return String(value || "")
    .replace(/!\[[^\]]*]\([^)]+\)/g, "")
    .replace(/\[([^\]]+)]\([^)]+\)/g, "$1")
    .replace(/<[^>]+>/g, "")
    .replace(/[*_`~>#]/g, "")
    .replace(/\\([.()\[\]])/g, "$1")
    .replace(/[ \t]+/g, " ")
    .trim();
}

function cleanArticle(raw) {
  let text = String(raw || "").replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, "");
  text = text.split(/\r?\n/).filter((line) => !/^\s*!\[[^\]]*]\(data:image/i.test(line)).join("\n");
  text = text
    .replace(/data:image\/[a-z+.-]+;base64,[A-Za-z0-9+/=]+/gi, "")
    .replace(/^\s*!\[[^\]]*]\(data:image[^\n]*\)\s*$/gim, "")
    .replace(/^\s*!\[[^\]]*]\([^)]*(?:1x1|spacer|pixel)[^)]*\)\s*$/gim, "")
    .replace(/^\s*<img[^>]*(?:1x1|spacer|pixel)[^>]*>\s*$/gim, "");
  const noiseMarkers = ["继续滑动看下一个", "微信扫一扫", "关注公众号", "预览时标签不可点", "喜欢此内容的人还喜欢"];
  const markerIndex = noiseMarkers.map((marker) => text.indexOf(marker)).filter((index) => index >= 0).sort((a, b) => a - b)[0];
  if (Number.isInteger(markerIndex)) text = text.slice(0, markerIndex);
  return text.replace(/\r/g, "").replace(/\n{3,}/g, "\n\n").trim();
}

function headingFromLine(line) {
  const markdown = line.match(/^#{1,4}\s+(.+)$/);
  if (markdown) return cleanInline(markdown[1]);
  const bold = line.match(/^\s*\*\*(.{2,60}?)\*\*\s*$/);
  if (bold) return cleanInline(bold[1]);
  const numbered = cleanInline(line).match(/^(?:第[一二三四五六七八九十\d]+[步部分章节]|[一二三四五六七八九十]+、|\(?\d+\)?[.、])\s*(.{2,50})$/);
  return numbered ? cleanInline(numbered[0]) : "";
}

function sentenceScore(sentence) {
  let score = 0;
  if (/不是.+而是|核心|本质|意味着|决定|关键|问题在于|换句话说/.test(sentence)) score += 5;
  if (/\d|一二三四五六七八九十/.test(sentence)) score += 2;
  if (/AI|Agent|投资风格|维度|产品|用户|决策|记忆|工作流/i.test(sentence)) score += 2;
  if (sentence.length >= 28 && sentence.length <= 130) score += 1;
  return score;
}

function keySentences(text, max = 5) {
  const sentences = cleanInline(text).match(/[^。！？!?；;]+[。！？!?；;]?/g) || [];
  return sentences
    .map((sentence, index) => ({ text: sentence.trim(), index, score: sentenceScore(sentence) }))
    .filter((item) => item.text.length >= 12)
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, max)
    .sort((a, b) => a.index - b.index)
    .map((item) => item.text.slice(0, 180));
}

function parseBlocks(cleaned) {
  const lines = cleaned.split("\n");
  const blocks = [];
  let current = { title: "开篇", lines: [], type: "prose" };
  let tableRows = [];

  function flushTable() {
    if (!tableRows.length) return;
    current.lines.push(tableRows.join("\n"));
    current.type = "table";
    tableRows = [];
  }

  function flushBlock() {
    flushTable();
    const text = current.lines.join("\n").trim();
    if (text) blocks.push({ ...current, text });
  }

  for (const line of lines) {
    const heading = headingFromLine(line);
    if (heading) {
      flushBlock();
      current = { title: heading, lines: [], type: "section" };
      continue;
    }
    if (/^\s*\|.+\|\s*$/.test(line) && !/^\s*\|?\s*[-:]+/.test(line)) {
      tableRows.push(cleanInline(line).replace(/\s*\|\s*/g, "｜"));
      continue;
    }
    flushTable();
    if (cleanInline(line)) current.lines.push(line);
  }
  flushBlock();
  return blocks;
}

function compactBlocks(blocks, maxBlocks = 18) {
  return blocks.slice(0, maxBlocks).map((block, index) => ({
    id: `b${String(index + 1).padStart(2, "0")}`,
    type: block.type,
    title: cleanInline(block.title).slice(0, 60),
    relation: /不是.+而是|对比|相比|两类|区别/.test(block.text) ? "comparison"
      : /第[一二三四五六七八九十\d]+步|首先|其次|然后|流程|阶段/.test(block.text) ? "process"
        : /因为|所以|导致|意味着|决定/.test(block.text) ? "causal"
          : /维度|分类|组合|框架|构成/.test(block.text) ? "framework" : "claim",
    key: keySentences(block.text, block.type === "table" ? 8 : 4),
  })).filter((block) => block.key.length);
}

function coreClaimCandidates(blocks) {
  return [...new Set(blocks.flatMap((block) => block.key)
    .filter((sentence) => /不是.+而是|核心|本质|意味着|决定|关键|问题在于|换句话说/.test(sentence)))]
    .slice(0, 6);
}

function extractTaxonomy(blocks) {
  return blocks.filter((block) => /^(?:长期|短期)\s*[+×].*(?:左侧|右侧).*(?:重仓|轻仓).*(?:集中|分散)/.test(cleanInline(block.title)))
    .slice(0, 16)
    .map((block) => {
      const text = cleanInline(block.text);
      return {
        name: cleanInline(block.title),
        concern: cleanInline(text.match(/关心[:：]\s*([^\n]{2,90})/)?.[1] || "").slice(0, 72),
        reject: cleanInline(text.match(/不能忍受[:：]\s*([^\n]{2,100})/)?.[1] || "").slice(0, 72),
      };
    });
}

function signalsFor(cleaned, blocks) {
  const comparison = (cleaned.match(/不是.+而是|对比|相比|一方面|另一方面|vs\.?/gi) || []).length;
  const process = (cleaned.match(/第[一二三四五六七八九十\d]+步|首先|其次|然后|最后|流程|阶段/g) || []).length;
  const data = (cleaned.match(/\d+(?:\.\d+)?%|\d+(?:\.\d+)?(?:亿|万|元|年|种|类)/g) || []).length;
  const taxonomy = (cleaned.match(/维度|组合|分类|画像|风格|矩阵/g) || []).length;
  return {
    comparison, process, data, taxonomy,
    headings: blocks.length,
    tables: blocks.filter((block) => block.type === "table").length,
  };
}

function recommendLayouts(signals) {
  const ranked = [
    ["cover.editorial", 100],
    ["comparison.split", signals.comparison * 5],
    ["process.timeline", signals.process * 4],
    ["framework.matrix", signals.taxonomy * 4],
    ["framework.axes", signals.taxonomy * 3],
    ["data.dashboard", signals.data * 2],
    ["data.ranking", signals.data + signals.tables * 8],
    ["framework.bento", signals.headings * 2],
    ["list.cards", 12],
    ["tail.cta", 10],
  ];
  return ranked.sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([layoutId]) => layoutId).slice(0, 8);
}

function fitBudget(analysis, maxChars) {
  let json = JSON.stringify(analysis);
  while (json.length > maxChars && analysis.blocks.length > 6) {
    analysis.blocks.pop();
    json = JSON.stringify(analysis);
  }
  while (json.length > maxChars) {
    let changed = false;
    for (const block of analysis.blocks) {
      if (block.key.length > 2) {
        block.key.pop();
        changed = true;
      }
    }
    json = JSON.stringify(analysis);
    if (!changed) break;
  }
  return analysis;
}

const args = parseArgs(process.argv.slice(2));
if (!args.input) {
  console.log("用法：node scripts/analyze_article.mjs --input 文章.md [--output analysis.compact.json] [--max-chars 4800]");
  process.exit(1);
}

const inputPath = path.resolve(args.input);
if (!fs.existsSync(inputPath)) {
  console.error(`[错误] 找不到文章：${inputPath}`);
  process.exit(1);
}

const raw = fs.readFileSync(inputPath, "utf8");
const cleaned = cleanArticle(raw);
const blocks = parseBlocks(cleaned);
const signals = signalsFor(cleaned, blocks);
const frontmatterTitle = raw.match(/^---[\s\S]*?^title:\s*["']?(.+?)["']?\s*$/m)?.[1] || "";
const title = cleanInline(frontmatterTitle || cleaned.match(/^#\s+(.+)$/m)?.[1] || path.basename(inputPath, path.extname(inputPath)));
const compact = compactBlocks(blocks);
const analysis = fitBudget({
  schemaVersion: 1,
  title,
  sourceFile: inputPath,
  stats: { rawChars: raw.length, cleanedChars: cleaned.length, reduction: Number((1 - cleaned.length / Math.max(raw.length, 1)).toFixed(3)) },
  signals,
  recommendedLayouts: recommendLayouts(signals),
  coreClaimCandidates: coreClaimCandidates(compact),
  taxonomyRecords: extractTaxonomy(blocks),
  blocks: compact,
}, Math.max(2600, Number.parseInt(args["max-chars"] || "4800", 10)));

const outputPath = path.resolve(args.output || path.join(path.dirname(inputPath), "analysis.compact.json"));
fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, `${JSON.stringify(analysis)}\n`, "utf8");
console.log(`[完成] 已生成紧凑分析：${outputPath}`);
console.log(`[统计] 原文 ${raw.length} 字符，清洗后 ${cleaned.length} 字符，模型输入文件 ${JSON.stringify(analysis).length} 字符。`);
console.log(`[结构] ${analysis.blocks.length} 个内容块；建议布局：${analysis.recommendedLayouts.join("、")}`);
