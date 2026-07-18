#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith("--")) continue;
    const key = token.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith("--")) {
      args[key] = true;
    } else {
      args[key] = next;
      i += 1;
    }
  }
  return args;
}

function usage() {
  return [
    "用法：",
    "  node scripts/plan_cards.mjs --input article.md --output 拆分方案.md --max-cards 10",
    "",
    "说明：",
    "  这个脚本只生成卡片拆分方案，不生成 HTML 或图片。",
  ].join("\n");
}

function stripMd(value) {
  return String(value || "")
    .replace(/!\[[^\]]*]\([^)]+\)/g, "")
    .replace(/\[([^\]]+)]\([^)]+\)/g, "$1")
    .replace(/[*_`~>#]/g, "")
    .replace(/^\s*[-+]\s+/, "")
    .replace(/^\s*\d+[.、]\s+/, "")
    .replace(/\s+/g, " ")
    .trim();
}

function trimText(value, max = 60) {
  const text = stripMd(value);
  if (text.length <= max) return text;
  return text.slice(0, max - 1).replace(/[，。、；：,.!?！？;:]?$/, "") + "…";
}

function dedupe(items) {
  const seen = new Set();
  const output = [];
  for (const item of items) {
    const text = stripMd(item);
    const key = text.replace(/\s+/g, "");
    if (!text || seen.has(key)) continue;
    seen.add(key);
    output.push(text);
  }
  return output;
}

function parseFrontmatter(raw) {
  const meta = {};
  let body = raw || "";
  if (!body.startsWith("---")) return { meta, body };
  const match = body.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!match) return { meta, body };
  body = body.slice(match[0].length);
  let currentKey = "";
  for (const line of match[1].split(/\r?\n/)) {
    const pair = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (pair) {
      currentKey = pair[1];
      meta[currentKey] = pair[2].trim().replace(/^["']|["']$/g, "");
      continue;
    }
    const listItem = line.match(/^\s+-\s*(.*)$/);
    if (listItem && currentKey) {
      if (!Array.isArray(meta[currentKey])) meta[currentKey] = [];
      meta[currentKey].push(listItem[1].replace(/^["']|["']$/g, ""));
    }
  }
  return { meta, body };
}

function removeNoise(rawBody) {
  let body = rawBody || "";
  body = body.replace(/```[\s\S]*?```/g, "");
  body = body.split(/\r?\n/).filter((line) => !/^\s*!\[[^\]]*]\(data:image/i.test(line)).join("\n");
  body = body.replace(/!\[[^\]]*]\([^)]+\)/g, "");
  body = body.replace(/\r/g, "");
  const markers = ["**历**", "微信扫一扫赞赏作者", "继续滑动看下一个"];
  for (const marker of markers) {
    const index = body.indexOf(marker);
    if (index > 800) body = body.slice(0, index);
  }
  return body.trim();
}

function parseSections(body) {
  const sections = [];
  let current = null;
  const intro = [];
  for (const line of body.split("\n")) {
    const heading = line.match(/^(#{1,3})\s+(.+)$/);
    const boldHeading = line.match(/^\s*\*\*(.{2,60}?)\*\*\s*$/);
    const numberedHeading = stripMd(line).match(/^(?:第[一二三四五六七八九十\d]+[步部分章节]|[一二三四五六七八九十]+、|\(?\d+\)?[.、])\s*.{2,55}$/);
    const title = heading && heading[1].length <= 2 ? stripMd(heading[2]) : boldHeading ? stripMd(boldHeading[1]) : numberedHeading ? stripMd(numberedHeading[0]) : "";
    if (title) {
      if (current) sections.push(current);
      current = { title, content: [] };
      continue;
    }
    if (current) current.content.push(line);
    else intro.push(line);
  }
  if (current) sections.push(current);
  return {
    intro: intro.join("\n"),
    sections: sections.filter((section) => section.title && section.content.join("").trim().length > 20),
  };
}

function extractSentences(text) {
  const cleaned = stripMd(text).replace(/\s+/g, " ");
  return (cleaned.match(/[^。！？!?；;]+[。！？!?；;]?/g) || [])
    .map((item) => item.trim())
    .filter((item) => item.length >= 12);
}

function isNoiseText(text) {
  return /双人播客|不想看|推荐\s*1\.5\s*倍|仅限.*播客|点击.*收听|音频版|视频版/.test(stripMd(text));
}

function isNoiseSection(section) {
  return /双人播客|播客|音频|视频|作者介绍|关于作者|相关阅读|推荐阅读/.test(section.title)
    || section.content.filter((line) => !isNoiseText(line)).join("").trim().length < 20;
}

function extractBoldClaims(raw) {
  const claims = [];
  for (const match of raw.matchAll(/\*\*([\s\S]*?)\*\*/g)) {
    const text = stripMd(match[1]);
    if (text.length >= 10) claims.push(text);
  }
  return claims;
}

function extractQuotes(raw) {
  return raw.split("\n")
    .filter((line) => /^\s*>\s+/.test(line))
    .map((line) => stripMd(line.replace(/^\s*>\s+/, "")))
    .filter((line) => line.length >= 8);
}

function extractSteps(body, sections) {
  const fromLists = body.split("\n")
    .map((line) => line.match(/^\s*(?:\d+\\?[.、]|[一二三四五六七八九十]+、)\s+(.+)$/))
    .filter(Boolean)
    .map((match) => stripMd(match[1]))
    .filter((text) => text.length >= 2 && text.length <= 28);
  const fromHeadings = sections
    .map((section) => section.title.match(/^第[一二三四五六七八九十]+步[:：]\s*(.+)$/))
    .filter(Boolean)
    .map((match) => stripMd(match[1]));
  return dedupe([...fromLists, ...fromHeadings]).slice(0, 8);
}

function isStepSection(section) {
  return /^第[一二三四五六七八九十]+步[:：]/.test(section.title);
}

function sectionBullets(section) {
  const raw = section.content.join("\n");
  const listItems = raw.split("\n")
    .filter((line) => /^\s*[-*+]\s+/.test(line))
    .map((line) => stripMd(line))
    .filter((line) => line.length >= 12 && !isNoiseText(line));
  const sentences = extractSentences(raw).filter((line) => !isNoiseText(line));
  return dedupe([...sentences.slice(0, 3), ...listItems]).slice(0, 4).map((item) => trimText(item, 64));
}

function getTitle(meta, body) {
  if (meta.title) return stripMd(meta.title);
  const firstHeading = body.match(/^#\s+(.+)$/m);
  if (firstHeading) return stripMd(firstHeading[1]);
  return body.split("\n").map(stripMd).find((line) => line.length > 8) || "内容卡片";
}

function getSubtitle(meta, intro, claims) {
  if (meta.description) return stripMd(meta.description);
  if (claims[0]) return trimText(claims[0], 48);
  return trimText(extractSentences(intro)[0] || "", 48);
}

function compactCoverQuote(text) {
  const source = stripMd(text);
  if (/少遗漏.*少误判.*少冲动/.test(source)) {
    return "AI 不替用户拍板，而是帮用户少遗漏、少误判、少冲动。";
  }
  return trimText(source, 42);
}

function selectCoverInsight(claims, quotes, fallback) {
  const candidates = dedupe([...claims, ...quotes, fallback ? [fallback] : []]);
  const preferred = candidates.find((item) => /不是.*入口|决策链|决策系统|沉淀|重构/.test(item));
  return trimText(preferred || candidates[0] || fallback, 64);
}

const PUBLICATION_META_PATTERN = /这组卡片|顺着卡片|把卡片|卡片主要|本文将|一起来看看|建议收藏|家人们|传播主线|逐步拆开|先记住/;

function publicationSentence(value, max = 110) {
  const text = trimText(stripMd(value), max)
    .replace(/^主线[，,:：]\s*/, "")
    .replace(/^[：:；;、，,\s]+|[：:；;、，,\s]+$/g, "");
  if (!text || PUBLICATION_META_PATTERN.test(text) || /我现在会把|这次我们不妨|本质区别其实是[。.]?$/.test(text)) return "";
  if (/^(不愿意|更愿意|能忍受|更害怕|宁愿|接受|希望|害怕|关心|不能忍受)/.test(text)) return "";
  if (/^一种是/.test(text) || (text.match(/\s-\s/g) || []).length >= 2) return "";
  return /[。！？!?]$/.test(text) ? text : `${text}。`;
}

function publicationBody(subtitle, cards, claims = []) {
  const fromCards = cards
    .filter((card) => !/封面|尾页|核心观点|总览/.test(card.type))
    .flatMap((card) => dedupe([
      ...card.zones.filter((zone) => /核心判断|底部强调|收束/.test(zone.area)).map((zone) => zone.text),
      card.takeaway,
      ...card.zones.filter((zone) => /引导句|正文要点/.test(zone.area)).flatMap((zone) => stripMd(zone.text).split(/[；;]\s*/)),
    ].map((value) => publicationSentence(value, 100)).filter(Boolean)).slice(0, 3));
  const fromClaims = claims.map((value) => publicationSentence(value, 100)).filter(Boolean);
  const lead = publicationSentence(subtitle, 110) || fromClaims[0] || fromCards[0] || "";
  const pool = dedupe([...fromClaims, ...fromCards]).filter((item) => item && item !== lead);
  const insights = pool.slice(0, 4);
  const middle = insights.slice(0, 2).map((item) => item.replace(/[。！？!?]$/, "")).join("，进而");
  const closing = insights.slice(2).join("");
  return [lead, middle ? `${middle}。` : "", closing]
    .filter(Boolean)
    .join("\n\n")
    .slice(0, 240);
}

function buildPublication(title, subtitle, cards, claims = []) {
  const cleanTitle = stripMd(title);
  const isTwoAi = /有些\s*AI.+有些\s*AI/i.test(cleanTitle);
  const original = cleanTitle.length <= 20 ? cleanTitle : "";
  // 从原文核心句提炼一个"结论型"标题:取最短的完整判断句,去掉标点。
  const conclusion = dedupe(claims)
    .map((item) => stripMd(item).replace(/[。！？!?、，,；;：:“”"']/g, "").trim())
    .filter((item) => item.length >= 8 && item.length <= 20)
    .sort((a, b) => a.length - b.length)[0] || "";
  const candidates = isTwoAi ? [
    "交付结果和理解你,是两种 AI",
    "选 AI 前,先看它默认为谁服务",
    "为什么有的 AI 越用越懂你",
    "两类 AI,差别不在能力在目标",
    "别拿一种 AI 的标准要求另一种",
  ] : [
    // 生成式初稿:优先用原标题与原文结论,不再套用"N张图看懂/重新理解"模板。
    // 提醒:以下多为占位,模型须按 references/publication-copy.md 用原文观点重写。
    original,
    conclusion,
  ];
  return {
    titles: dedupe(candidates.map((item) => stripMd(item).slice(0, 20))).filter(Boolean).slice(0, 5),
    body: publicationBody(subtitle, cards, claims),
  };
}

function firstUsefulSentence(section) {
  const raw = section.content.join("\n");
  return trimText(extractSentences(raw)[0] || sectionBullets(section)[0] || section.title, 60);
}

function emphasisForSection(section) {
  const raw = section.content.join("\n");
  const bold = extractBoldClaims(raw).find((item) => item.length >= 12);
  const quote = extractQuotes(raw).find((item) => item.length >= 12);
  return trimText(bold || quote || sectionBullets(section).slice(-1)[0] || "", 64);
}

function wireframe(card) {
  const rows = card.zones.map((zone) => `│ ${zone.area}：${trimText(zone.text, 30).padEnd(30, " ")} │`);
  return ["┌────────────────────────────────────┐", ...rows, "└────────────────────────────────────┘"].join("\n");
}

function layoutIdFor(card) {
  const text = `${card.type} ${card.title} ${card.zones.map((zone) => `${zone.area} ${zone.text}`).join(" ")}`;
  if (/封面/.test(card.type)) return "cover.editorial";
  if (/尾页/.test(card.type)) return "tail.cta";
  if (/核心观点/.test(card.type)) return "list.cards";
  if (/16\s*种|矩阵|组合分类/.test(text)) return "framework.matrix";
  if (/长期.*短期|左侧.*右侧|重仓.*轻仓|集中.*分散|对照|对比/.test(text)) return "comparison.split";
  if (/步骤|流程|阶段|主线/.test(text)) return "process.timeline";
  if (/维度|框架|总览/.test(text)) return "framework.bento";
  if (/数据|比例|排名|亿元|万元|%/.test(text)) return "data.dashboard";
  return "list.cards";
}

function purposeFor(card, index, total) {
  if (/封面/.test(card.type)) return "建立阅读承诺：告诉读者这组卡片要解决什么问题。";
  if (/尾页/.test(card.type)) return "收束全文并留下一个可复述、可行动的最终判断。";
  if (/总览/.test(card.type)) return "先给出全局地图，降低后续逐页理解成本。";
  return `承接第 ${index} 张，在整条叙事中完成一个不可替代的论证步骤。`;
}

function takeawayFor(card) {
  const preferred = card.zones.find((zone) => /核心判断|底部强调|收束|提示/.test(zone.area))?.text;
  return trimText(preferred || card.zones.find((zone) => /引导句|副标题|正文要点/.test(zone.area))?.text || card.title, 90);
}

function buildPlan(markdown, maxCards) {
  const { meta, body: rawBody } = parseFrontmatter(markdown);
  const body = removeNoise(rawBody);
  const { intro, sections } = parseSections(body);
  const contentSections = sections.filter((section) => !isNoiseSection(section));
  const title = getTitle(meta, body);
  const boldClaims = extractBoldClaims(body);
  const quotes = extractQuotes(body);
  const steps = extractSteps(body, contentSections);
  const subtitle = getSubtitle(meta, intro, boldClaims);
  const introSentences = extractSentences(intro);
  // 正文段落里的完整句子:当文章没有前言/加粗/引用时,作为观点来源兜底,保证方案仍来自原文而非模板。
  const sectionSentences = dedupe(
    contentSections.flatMap((section) => extractSentences(section.content.join("\n")))
      .filter((sentence) => !isNoiseText(sentence)),
  );
  const takeaways = dedupe([...quotes, ...boldClaims, ...introSentences, ...sectionSentences]).slice(0, 8);
  const effectiveSubtitle = subtitle || trimText(sectionSentences[0] || "", 48);
  const coverInsight = selectCoverInsight(boldClaims, quotes, effectiveSubtitle);
  const coverQuote = compactCoverQuote(takeaways[0] || effectiveSubtitle);

  const cards = [];
  cards.push({
    type: "封面卡",
    title,
    layout: "顶部品牌文字标 + 大标题 + 副标题 + 中部金句 + 底部核心判断。封面不放长正文。",
    zones: [
      { area: "顶部品牌", text: "前面-Aaron" },
      { area: "主标题", text: title },
      { area: "副标题", text: effectiveSubtitle },
      { area: "中部金句", text: coverInsight },
      { area: "核心判断", text: coverQuote },
    ],
  });

  if (steps.length >= 3 && cards.length < maxCards - 1) {
    cards.push({
      type: "总览卡",
      title: steps.length >= 7 ? `${steps.length}步主线` : "文章主线",
      layout: "编号网格或步骤清单，让读者先看懂整篇文章结构。",
      zones: [
        { area: "主标题", text: steps.length >= 7 ? `${steps.length}步主线` : "文章主线" },
        { area: "正文", text: steps.map((step, index) => `${index + 1}. ${step}`).join(" / ") },
        { area: "底部提示", text: "这组卡片会沿着这条决策链逐步拆开。" },
      ],
    });
  }

  const stepSections = contentSections.filter(isStepSection);

  if (stepSections.length >= 5) {
    const slots = Math.max(0, maxCards - cards.length - 1);
    cards.push(...stepSections.slice(0, slots).map((section) => ({
      type: "步骤拆解卡",
      title: trimText(section.title, 30),
      layout: "每张讲一个步骤：步骤标题 + 关键问题 + AI 应承担的角色。",
      zones: [
        { area: "步骤标题", text: trimText(section.title, 30) },
        { area: "引导句", text: firstUsefulSentence(section) },
        { area: "正文要点", text: sectionBullets(section).join("；") },
        { area: "底部强调", text: emphasisForSection(section) },
      ],
    })).filter((card) => card.zones.some((zone) => zone.text)));
  } else if (takeaways.length >= 3 && cards.length < maxCards - 1) {
    cards.push({
      type: "核心观点卡",
      title: "先记住这几个判断",
      layout: "3 到 4 条强判断，每条独立成块。",
      zones: [
        { area: "主标题", text: "先记住这几个判断" },
        { area: "正文要点", text: takeaways.slice(0, 4).map((item, index) => `${index + 1}. ${trimText(item, 72)}`).join("；") },
        { area: "底部强调", text: "这些判断构成整篇文章的传播主线。" },
      ],
    });

    const slots = Math.max(0, maxCards - cards.length - 1);
    const sectionCards = contentSections
      .filter((section) => !/历史|目录|结尾/.test(section.title))
      .slice(0, slots)
      .map((section) => ({
        type: "正文拆解卡",
        title: trimText(section.title, 30),
        layout: "章节标题 + 2 到 4 个要点 + 可选强调句。",
        zones: [
          { area: "章节标题", text: trimText(section.title, 30) },
          { area: "引导句", text: firstUsefulSentence(section) },
          { area: "正文要点", text: sectionBullets(section).join("；") },
          { area: "底部强调", text: emphasisForSection(section) },
        ],
      }))
      .filter((card) => card.zones.some((zone) => zone.text));
    cards.push(...sectionCards);
  }

  const finalClaim = [...boldClaims].reverse().find((item) => item.length >= 14) || takeaways[takeaways.length - 1] || effectiveSubtitle;
  cards.push({
    type: "尾页卡",
    title: "最后一句",
    layout: "强收束句 + 品牌署名 + 二维码，不写长自我介绍。",
    zones: [
      { area: "主标题", text: "最后一句" },
      { area: "收束金句", text: trimText(finalClaim, 90) },
      { area: "品牌署名", text: "前面-Aaron" },
      { area: "关注入口", text: "关注前面-Aaron，持续分享 AI、创作与金融科技观察" },
    ],
  });

  const finalCards = cards.slice(0, maxCards).map((card, index, list) => ({
    ...card,
    layoutId: layoutIdFor(card),
    themeId: "warm-editorial",
    purpose: purposeFor(card, index, list.length),
    takeaway: takeawayFor(card),
    sourceAnchor: /封面|尾页/.test(card.type) ? "全文" : card.title,
  }));
  return {
    title,
    subtitle: effectiveSubtitle,
    centralQuestion: extractSentences(body).find((sentence) => /[？?]/.test(sentence) && !isNoiseText(sentence)) || (title.includes("？") || title.includes("?") ? title : `关于“${stripMd(title).slice(0, 18)}”，真正需要回答的问题是什么？`),
    coreThesis: coverInsight || coverQuote || effectiveSubtitle,
    narrative: "提出问题 → 给出全局地图 → 分模块完成论证 → 提炼行动含义 → 用一句话收束",
    created: meta.created || "",
    source: meta.source || "",
    cards: finalCards,
    publication: buildPublication(title, effectiveSubtitle, finalCards, takeaways),
  };
}

function renderPlan(plan) {
  const lines = [];
  lines.push(`# 卡片拆分方案：${plan.title}`);
  lines.push("");
  lines.push(`建议张数：${plan.cards.length} 张`);
  if (plan.created) lines.push(`原文日期：${plan.created}`);
  if (plan.source) lines.push(`来源：${plan.source}`);
  lines.push("");
  lines.push("说明：这只是出图前的内容方案，确认后再生成 HTML 卡片。");
  lines.push("");
  lines.push("## 文章解构");
  lines.push("");
  lines.push("| 项目 | 内容 |");
  lines.push("| --- | --- |");
  lines.push(`| 核心问题 | ${plan.centralQuestion} |`);
  lines.push(`| 核心主张 | ${plan.coreThesis} |`);
  lines.push(`| 叙事路径 | ${plan.narrative} |`);
  lines.push(`| 覆盖模块 | ${plan.cards.filter((card) => !/封面|尾页/.test(card.type)).map((card) => card.sourceAnchor).join(" → ")} |`);
  lines.push("");
  lines.push("## 小红书发布文案");
  lines.push("");
  lines.push("| 区域 | 文字 |");
  lines.push("| --- | --- |");
  lines.push(`| 标题建议 | ${plan.publication.titles.join("<br>")} |`);
  lines.push(`| 正文 | ${plan.publication.body.replace(/\n+/g, "<br>")} |`);
  lines.push("");
  plan.cards.forEach((card, index) => {
    lines.push(`## ${index + 1}. ${card.type}｜${card.title}`);
    lines.push("");
    lines.push(`呈现方式：${card.layout}`);
    lines.push("");
    lines.push("线框预览：");
    lines.push("");
    lines.push("```text");
    lines.push(wireframe(card));
    lines.push("```");
    lines.push("");
    lines.push("卡片具体文案：");
    lines.push("");
    lines.push("| 区域 | 文字 |");
    lines.push("| --- | --- |");
    lines.push(`| 布局 | ${card.layoutId} |`);
    lines.push(`| 配色 | ${card.themeId} |`);
    lines.push(`| 本卡任务 | ${card.purpose} |`);
    lines.push(`| 读者看完应理解 | ${card.takeaway} |`);
    lines.push(`| 原文依据 | ${card.sourceAnchor} |`);
    card.zones.forEach((zone) => {
      lines.push(`| ${zone.area} | ${zone.text || "（留空）"} |`);
    });
    lines.push("");
  });
  return lines.join("\n");
}

const args = parseArgs(process.argv.slice(2));
if (args.help || args.h) {
  console.log(usage());
  process.exit(0);
}
if (!args.input) {
  console.error("[错误] 缺少 --input");
  console.error(usage());
  process.exit(1);
}

const inputPath = path.resolve(args.input);
if (!fs.existsSync(inputPath)) {
  console.error(`[错误] 找不到输入文件：${inputPath}`);
  process.exit(1);
}

const maxCards = Math.max(4, Math.min(16, Number.parseInt(args["max-cards"] || "10", 10)));
const markdown = fs.readFileSync(inputPath, "utf8");
const plan = buildPlan(markdown, maxCards);
const output = renderPlan(plan);

if (args.output) {
  const outputPath = path.resolve(args.output);
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, output, "utf8");
  console.log(`[完成] 已生成拆分方案：${outputPath}`);
} else {
  console.log(output);
}
