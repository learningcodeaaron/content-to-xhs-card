import { inferKind as inferKindFromLayout, layoutForId, normalizeLayoutId } from "./layout-registry.mjs";

const LEGACY_TYPE_TO_LAYOUT = {
  cover: "cover.editorial",
  framework: "process.timeline",
  takeaways: "list.cards",
  section: "list.cards",
  tail: "tail.cta",
};

const KIND_PATTERNS = [
  ["cover", /cover|封面/i],
  ["comparison", /comparison|versus|对照|对比/i],
  ["process", /process|timeline|流程|阶段|步骤|闭环/i],
  ["framework", /framework|matrix|axes|总览|框架|矩阵|维度/i],
  ["data", /data|ranking|chart|数据|排名|图表/i],
  ["quote", /quote|portrait|人物|引语/i],
  ["statement", /statement|poster|命题|海报|判断/i],
  ["tail", /tail|尾页|结尾|最后|收束/i],
  ["list", /takeaways|list|观点|清单|要点|正文/i],
];

export function stripMarkdown(value) {
  return String(value || "")
    .replace(/<br\s*\/?\s*>/gi, "\n")
    .replace(/!\[[^\]]*]\([^)]+\)/g, "")
    .replace(/\[([^\]]+)]\([^)]+\)/g, "$1")
    .replace(/[*_`~>#]/g, "")
    .replace(/[ \t]+/g, " ")
    .trim();
}

function stableId(prefix, order) {
  return `${prefix}-${String(order + 1).padStart(2, "0")}`;
}

function readField(source, names, fallback = "") {
  for (const name of names) {
    if (source?.[name] !== undefined && source?.[name] !== null) return source[name];
  }
  return fallback;
}

function splitValues(value) {
  if (Array.isArray(value)) return value;
  return String(value || "")
    .replace(/<br\s*\/?\s*>/gi, "\n")
    .split(/\r?\n|[；;]|\s+→\s+|\s+->\s+/);
}

function asList(value, max = 16) {
  return splitValues(value)
    .map((item) => stripMarkdown(String(item).replace(/^\s*\d+[.、]\s*/, "")))
    .filter(Boolean)
    .slice(0, max);
}

function asItemList(value, max = 16) {
  if (Array.isArray(value)) {
    return value.slice(0, max).map((item) => {
      if (typeof item === "string") return { title: stripMarkdown(item), body: "" };
      return {
        title: stripMarkdown(item?.title || item?.name || item?.label || ""),
        body: stripMarkdown(item?.body || item?.text || item?.description || item?.note || ""),
        value: stripMarkdown(item?.value || ""),
      };
    }).filter((item) => item.title || item.body || item.value);
  }
  return asList(value, max).map((text) => {
    const parts = text.split(/\s*[｜|]\s*/);
    return { title: parts[0] || "", body: parts[1] || "", value: parts[2] || "" };
  });
}

function inferKind(value, fallback = "list") {
  const text = stripMarkdown(value);
  return KIND_PATTERNS.find(([, pattern]) => pattern.test(text))?.[0] || fallback;
}

function splitTableRow(line) {
  const text = line.trim().replace(/^\|/, "").replace(/\|$/, "");
  const cells = [];
  let current = "";
  let escaped = false;
  for (const char of text) {
    if (escaped) {
      current += char;
      escaped = false;
    } else if (char === "\\") {
      escaped = true;
    } else if (char === "|") {
      cells.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  cells.push(current.trim());
  return cells;
}

function parsePlanSections(markdown) {
  const lines = String(markdown || "").replace(/\r/g, "").split("\n");
  const sections = [];
  let current = null;
  let inFence = false;
  for (const line of lines) {
    if (/^```/.test(line.trim())) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;
    const heading = line.match(/^##\s+(?:\d+[.、]\s*)?(.+?)(?:[｜|]\s*(.+))?\s*$/);
    if (heading) {
      if (current) sections.push(current);
      current = { label: stripMarkdown(heading[1]), headingTitle: stripMarkdown(heading[2]), fields: {} };
      continue;
    }
    if (!current || !/^\s*\|/.test(line)) continue;
    const cells = splitTableRow(line);
    if (cells.length < 2) continue;
    const key = stripMarkdown(cells[0]);
    const value = cells.slice(1).join(" | ").trim();
    if (!key || /^[-: ]+$/.test(key) || /^(区域|字段|项目)$/.test(key)) continue;
    current.fields[key] = value;
  }
  if (current) sections.push(current);
  return sections;
}

function parseSide(fields, side) {
  const title = stripMarkdown(readField(fields, [`${side}标题`, `${side}栏标题`]));
  const items = asItemList(readField(fields, [`${side}内容`, `${side}栏内容`, side]), 6);
  return { title, items };
}

function parseAxes(fields) {
  return asList(readField(fields, ["四轴", "坐标轴", "维度", "二元轴"]), 6).map((text) => {
    const [pair, body = ""] = text.split(/\s*[｜|]\s*/);
    const [left = "", right = ""] = pair.split(/\s*(?:↔|vs\.?|VS|—)\s*/);
    return { left: stripMarkdown(left), right: stripMarkdown(right), body: stripMarkdown(body) };
  }).filter((item) => item.left || item.right);
}

function contentFromFields(fields, headingTitle = "") {
  const title = stripMarkdown(readField(fields, ["主标题", "标题"], headingTitle));
  const items = asItemList(readField(fields, ["正文要点", "正文", "要点", "步骤", "节点", "清单"]), 16);
  const matrix = asItemList(readField(fields, ["矩阵", "分类矩阵", "16种风格", "组合"]), 16);
  const stats = asItemList(readField(fields, ["数据", "排名数据", "统计数据"]), 12);
  const left = parseSide(fields, "左侧");
  const right = parseSide(fields, "右侧");
  return {
    kicker: stripMarkdown(readField(fields, ["栏目", "标签", "眉题", "页签"])),
    title,
    subtitle: stripMarkdown(readField(fields, ["副标题", "价值说明"])),
    lead: stripMarkdown(readField(fields, ["引导句", "导语", "中部金句"])),
    quote: stripMarkdown(readField(fields, ["核心判断", "底部判断", "底部强调", "强调句", "金句", "收束金句", "最终判断", "AI角色"])),
    cta: stripMarkdown(readField(fields, ["关注入口", "行动引导", "CTA"])),
    source: stripMarkdown(readField(fields, ["来源", "数据来源"])),
    items,
    matrix,
    stats,
    axes: parseAxes(fields),
    left,
    right,
  };
}

function compactContent(content) {
  return Object.fromEntries(Object.entries(content).filter(([, value]) => {
    if (Array.isArray(value)) return value.length;
    if (value && typeof value === "object") return Object.values(value).some((part) => Array.isArray(part) ? part.length : Boolean(part));
    return value !== "" && value !== null && value !== undefined;
  }));
}

const PUBLICATION_META_PATTERN = /这组卡片|顺着卡片|把卡片|卡片主要|本文将|一起来看看|建议收藏|家人们/;

function publicationSentence(value, max = 110) {
  const text = stripMarkdown(value).replace(/^主线[，,:：]\s*/, "").replace(/^[：:；;、，,\s]+|[：:；;、，,\s]+$/g, "").slice(0, max);
  if (!text || PUBLICATION_META_PATTERN.test(text) || /我现在会把|这次我们不妨|本质区别其实是[。.]?$/.test(text)) return "";
  if (/^(不愿意|更愿意|能忍受|更害怕|宁愿|接受|希望|害怕|关心|不能忍受)/.test(text)) return "";
  if (/^一种是/.test(text) || (text.match(/\s-\s/g) || []).length >= 2) return "";
  return /[。！？!?]$/.test(text) ? text : `${text}。`;
}

function publicationBody(title, cards) {
  const cover = cards.find((card) => card.kind === "cover");
  const thesis = publicationSentence(cover?.content?.quote || cover?.content?.subtitle || title, 110);
  const candidates = cards
    .filter((card) => !["cover", "tail"].includes(card.kind))
    .flatMap((card) => {
      const content = card.content || {};
      const itemText = [...(content.items || []), ...(content.matrix || []), ...(content.stats || [])]
        .map((item) => typeof item === "string" ? item : [item.title || item.label, item.body || item.value].filter(Boolean).join("："));
      const sideText = [content.left, content.right]
        .flatMap((side) => side ? [side.title, ...(side.items || []).map((item) => typeof item === "string" ? item : [item.title, item.body].filter(Boolean).join("："))] : []);
      return [content.quote, content.lead, ...itemText, ...sideText, content.subtitle, content.title];
    })
    .flatMap((value) => stripMarkdown(value).split(/[；;]\s*/))
    .map((value) => publicationSentence(value, 100))
    .filter(Boolean)
    .filter((item, index, list) => item !== thesis && list.indexOf(item) === index)
    .slice(0, 5);
  const middle = candidates.slice(0, 2).map((item) => item.replace(/[。！？!?]$/, "")).join("；");
  return [thesis, middle ? `${middle}。` : "", candidates.slice(2).join("")]
    .filter(Boolean)
    .join("\n\n")
    .slice(0, 280);
}

function defaultPublication(title, cards) {
  const cleanTitle = stripMarkdown(title);
  const isTwoAi = /有些\s*AI.+有些\s*AI/i.test(cleanTitle);
  const bracketTopic = cleanTitle.match(/【([^】]{2,14})】/)?.[1] || "";
  const topic = isTwoAi ? "两类AI" : bracketTopic || cleanTitle.split(/[：:]/).at(-1).replace(/^(重新|再|如何|为什么)/, "").replace(/[！!？?。；;，“”"'【】\[\]()（）]/g, "").slice(0, 14) || "这件事";
  const mainCards = cards.filter((card) => !["cover", "tail"].includes(card.kind));
  const count = Math.max(3, Math.min(9, mainCards.length));
  const numberPairs = [...cleanTitle.matchAll(/(\d+)种([^、，,]{1,8})/g)].map((match) => `${match[1]}种${match[2]}`);
  const numericTitle = numberPairs.length >= 2 ? `${numberPairs[0]}，组合出${numberPairs[1]}` : "";
  const candidates = isTwoAi
    ? ["两类AI，差别不只是能力", "交付结果与长期理解", "为什么有些AI越用越懂你", `${count}张图看懂两类AI`, "选AI，先看它默认服务谁"]
    : [numericTitle, cleanTitle.length <= 24 ? cleanTitle : "", `重新理解${topic}`, `${count}张图看懂${topic}`, `${topic}，别只看表面标签`, `为什么${topic}值得重新理解`];
  return {
    titles: candidates.map((item) => stripMarkdown(item).slice(0, 24)).filter((item, index, list) => item && list.indexOf(item) === index).slice(0, 5),
    body: publicationBody(title, cards),
  };
}

function normalizePublication(rawPublication, title, cards, preserveEmpty = false) {
  if (!rawPublication && !preserveEmpty) return defaultPublication(title, cards);
  const titles = asList(rawPublication?.titles || rawPublication?.titleSuggestions || [], 5).map((item) => item.slice(0, 30));
  const body = stripMarkdown(rawPublication?.body || rawPublication?.caption || rawPublication?.text || "").slice(0, 500);
  return { titles, body };
}

function cardFromPlanSection(section, order) {
  const layoutHint = readField(section.fields, ["布局", "布局类型", "视觉结构", "呈现方式"]);
  const kindHint = readField(section.fields, ["卡片类型", "类型"], section.label);
  const content = compactContent(contentFromFields(section.fields, section.headingTitle || section.label));
  const kind = inferKind(`${kindHint} ${layoutHint}`, "list");
  const layoutId = normalizeLayoutId(layoutHint, kind, content);
  return {
    id: stableId("card", order),
    kind: inferKindFromLayout(layoutId, kind),
    layoutId,
    themeId: stripMarkdown(readField(section.fields, ["主题", "配色"])) || "warm-editorial",
    content,
    meta: {
      planSection: section.label,
      purpose: stripMarkdown(readField(section.fields, ["本卡任务", "页面任务"])),
      takeaway: stripMarkdown(readField(section.fields, ["读者看完应理解", "读者收获"])),
      sourceAnchor: stripMarkdown(readField(section.fields, ["原文依据", "来源段落"])),
    },
  };
}

function legacyCardToV2(raw, order) {
  const type = inferKind(readField(raw, ["type", "类型", "卡片类型"]), "section");
  const legacyType = ["cover", "framework", "takeaways", "section", "tail"].includes(type) ? type : "section";
  const title = stripMarkdown(readField(raw, ["title", "标题", "主标题"], `第 ${order + 1} 张`));
  const rawItems = readField(raw, ["items", "bullets", "steps", "正文", "要点"]);
  const content = compactContent({
    title,
    subtitle: stripMarkdown(readField(raw, ["subtitle", "副标题", "价值说明"])),
    lead: stripMarkdown(readField(raw, ["lead", "引导句", "导语", "insight", "金句"])),
    quote: stripMarkdown(readField(raw, ["quote", "核心判断", "底部强调", "收束金句"])),
    cta: stripMarkdown(readField(raw, ["cta", "关注入口", "行动引导"])),
    items: asItemList(rawItems, 16),
  });
  const relationText = `${title} ${content.lead || ""} ${content.quote || ""}`;
  let layoutId = LEGACY_TYPE_TO_LAYOUT[legacyType];
  if (legacyType === "section" || legacyType === "takeaways") {
    if (/怎样|流程|步骤|阶段|节点|要过.+关/.test(title)) layoutId = "process.timeline";
    else if (/工作现场|系统|地图|构成|能力|企业需要/.test(title)) layoutId = "framework.bento";
    else if (/两类|对比|区别|不是.+而是|不必/.test(relationText)) layoutId = "comparison.split";
    else if (/怎样|流程|步骤|阶段|节点|要过.+关/.test(relationText)) layoutId = "process.timeline";
    else if (/工作现场|系统|地图|构成|能力|企业需要/.test(relationText)) layoutId = "framework.bento";
    else if (/不要卖|核心命题|本质/.test(relationText)) layoutId = "statement.poster";
  }
  return {
    id: raw.id || stableId("card", order),
    kind: inferKindFromLayout(layoutId, legacyType === "section" || legacyType === "takeaways" ? "list" : legacyType),
    layoutId,
    themeId: raw.themeId || "warm-editorial",
    content,
    removedRoles: [],
    ...(Array.isArray(raw.elements) ? { elements: raw.elements } : {}),
    meta: { ...(raw.meta || {}), migratedFrom: "v1", legacyType },
  };
}

function normalizeV2Card(raw, order) {
  const content = compactContent({
    ...(raw.content || {}),
    title: stripMarkdown(raw.content?.title ?? raw.title ?? ""),
  });
  const kindHint = raw.kind || inferKind(raw.type, "list");
  const layoutId = normalizeLayoutId(raw.layoutId || raw.layout, kindHint, content);
  return {
    ...raw,
    id: raw.id || stableId("card", order),
    kind: inferKindFromLayout(layoutId, kindHint),
    layoutId,
    themeId: raw.themeId || "warm-editorial",
    content,
    removedRoles: Array.isArray(raw.removedRoles) ? raw.removedRoles : [],
  };
}

export function normalizeDeck(rawDeck) {
  if (!rawDeck || !Array.isArray(rawDeck.cards)) return null;
  const isV2 = Number(rawDeck.schemaVersion) >= 2 || rawDeck.cards.some((card) => card.layoutId || card.content || card.elements);
  const cards = rawDeck.cards.map((card, order) => isV2 ? normalizeV2Card(card, order) : legacyCardToV2(card, order));
  const title = stripMarkdown(rawDeck.title || rawDeck.meta?.title || cards[0]?.content?.title || "内容卡片");
  const hasPublication = Object.prototype.hasOwnProperty.call(rawDeck, "publication");
  return {
    ...rawDeck,
    schemaVersion: 2,
    id: rawDeck.id || `deck-${title.replace(/\s+/g, "-").slice(0, 24) || "content"}`,
    title,
    subtitle: stripMarkdown(rawDeck.subtitle || rawDeck.meta?.subtitle || ""),
    source: stripMarkdown(rawDeck.source || rawDeck.meta?.source || ""),
    created: stripMarkdown(rawDeck.created || rawDeck.meta?.created || ""),
    canvas: { width: 1080, height: 1440, ...(rawDeck.canvas || {}) },
    publication: normalizePublication(rawDeck.publication, title, cards, hasPublication),
    cards,
  };
}

export function parsePlanMarkdown(markdown) {
  const sections = parsePlanSections(markdown);
  const publicationSection = sections.find((section) => /小红书发布文案|发布文案|发布建议/.test(section.label));
  const cardSections = sections.filter((section) => section !== publicationSection && !/文章解构|内容地图|质量检查/.test(section.label));
  const cards = cardSections.map(cardFromPlanSection);
  const firstHeading = String(markdown || "").match(/^#\s+(.+)$/m)?.[1] || "";
  const title = cards.find((card) => card.kind === "cover")?.content?.title
    || stripMarkdown(firstHeading.replace(/^卡片拆分方案(?:（[^）]+）)?[:：]?\s*/, ""))
    || "内容卡片";
  const publication = publicationSection ? {
    titles: asList(readField(publicationSection.fields, ["标题建议", "标题"]), 5).map((item) => item.slice(0, 30)),
    body: stripMarkdown(readField(publicationSection.fields, ["正文", "发布正文", "配文"])).slice(0, 500),
  } : defaultPublication(title, cards);
  return { schemaVersion: 2, title, publication, cards };
}

export function validateDeck(rawDeck) {
  const deck = normalizeDeck(rawDeck);
  const errors = [];
  const warnings = [];
  if (!deck) return { deck: null, errors: ["卡片数据必须包含 cards 数组。"], warnings };
  if (!deck.cards.length) errors.push("没有识别到任何卡片。确认 Markdown 中包含二级标题和字段表格。");
  if (deck.cards.length > 16) errors.push("卡片数量不能超过 16 张。");
  if (deck.cards.length && deck.cards.length < 4) warnings.push("卡片少于 4 张，长文结构可能没有被完整识别。");
  if (deck.publication.titles.length < 3) warnings.push("小红书标题建议少于 3 个，发布选择空间不足。");
  if (deck.publication.titles.length > 5) warnings.push("小红书标题建议超过 5 个，请收敛到最有传播力的选项。");
  deck.publication.titles.forEach((title, index) => {
    if (title.length > 24) warnings.push(`标题建议 ${index + 1} 超过 24 字，建议压缩。`);
  });
  if (!deck.publication.body) warnings.push("缺少小红书发布正文。");
  if (deck.publication.body && deck.publication.body.length < 80) warnings.push("小红书发布正文少于 80 字，可能不足以独立讲清原文核心观点。");
  if (deck.publication.body.length > 320) warnings.push("小红书发布正文超过 320 字，建议进一步压缩。");
  if (PUBLICATION_META_PATTERN.test(deck.publication.body)) warnings.push("发布正文包含介绍卡片或平台套话，应改为直接总结原文观点。");
  if ((deck.publication.body.match(/\p{Extended_Pictographic}/gu) || []).length > 1) warnings.push("发布正文包含多个 emoji，不符合默认的专业表达风格。");

  deck.cards.forEach((card, index) => {
    const label = `第 ${index + 1} 张`;
    const layout = layoutForId(card.layoutId);
    if (!layout) errors.push(`${label}使用了未知布局：${card.layoutId}`);
    const contentCount = Math.max(
      card.content?.items?.length || 0,
      card.content?.matrix?.length || 0,
      card.content?.stats?.length || 0,
      card.content?.axes?.length || 0,
    );
    if (layout && contentCount > layout.maxItems) warnings.push(`${label}内容项超过布局建议上限 ${layout.maxItems}，请在 HTML 中检查溢出。`);
    if (!card.content?.title && !card.elements?.length) warnings.push(`${label}没有标题；v2 允许空白卡，但请确认这是有意的。`);
    if (card.content?.title?.length > 42) warnings.push(`${label}标题超过 42 字，建议检查自动缩字后的可读性。`);
  });
  return { deck, errors, warnings };
}
