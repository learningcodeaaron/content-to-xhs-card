export const LAYOUTS = [
  { id: "cover.editorial", label: "编辑式封面", kind: "cover", semantic: ["cover", "statement"], maxItems: 2 },
  { id: "cover.image", label: "图像封面", kind: "cover", semantic: ["cover", "portrait", "concept"], maxItems: 2 },
  { id: "statement.poster", label: "单命题海报", kind: "statement", semantic: ["statement", "definition", "concept"], maxItems: 5 },
  { id: "comparison.split", label: "左右镜像对照", kind: "comparison", semantic: ["comparison", "versus"], maxItems: 10 },
  { id: "process.timeline", label: "阶段链", kind: "process", semantic: ["process", "timeline", "steps"], maxItems: 6 },
  { id: "process.cycle", label: "循环闭环", kind: "process", semantic: ["cycle", "loop"], maxItems: 6 },
  { id: "framework.axes", label: "二元轴总览", kind: "framework", semantic: ["axes", "dimensions"], maxItems: 5 },
  { id: "framework.matrix", label: "矩阵分类", kind: "framework", semantic: ["matrix", "taxonomy", "quadrant"], maxItems: 16 },
  { id: "framework.bento", label: "Bento 层级", kind: "framework", semantic: ["hierarchy", "framework", "map"], maxItems: 7 },
  { id: "data.ranking", label: "排名条带", kind: "data", semantic: ["ranking", "data"], maxItems: 8 },
  { id: "data.dashboard", label: "数据仪表板", kind: "data", semantic: ["statistics", "data", "chart"], maxItems: 8 },
  { id: "list.cards", label: "要点卡组", kind: "list", semantic: ["list", "takeaways"], maxItems: 6 },
  { id: "quote.portrait", label: "人物观点", kind: "quote", semantic: ["quote", "portrait"], maxItems: 2 },
  { id: "tail.cta", label: "收束尾页", kind: "tail", semantic: ["tail", "cta"], maxItems: 3 },
];

export const LAYOUT_MAP = new Map(LAYOUTS.map((layout) => [layout.id, layout]));

const ALIASES = [
  [/封面|cover/i, "cover.editorial"],
  [/图像封面|人物封面|肖像/i, "cover.image"],
  [/海报|单命题|概念/i, "statement.poster"],
  [/对照|对比|左右|versus|vs/i, "comparison.split"],
  [/闭环|循环|cycle/i, "process.cycle"],
  [/流程|阶段|步骤|时间线|timeline/i, "process.timeline"],
  [/坐标|二元轴|维度轴/i, "framework.axes"],
  [/矩阵|象限|分类|taxonomy/i, "framework.matrix"],
  [/bento|层级|地图|框架/i, "framework.bento"],
  [/排名|排行|条带/i, "data.ranking"],
  [/数据|图表|仪表板|统计/i, "data.dashboard"],
  [/人物|引语|观点引用/i, "quote.portrait"],
  [/尾页|收束|cta/i, "tail.cta"],
  [/列表|要点|清单|观点/i, "list.cards"],
];

export function layoutForId(value) {
  return LAYOUT_MAP.get(String(value || "").trim()) || null;
}

export function normalizeLayoutId(value, kind = "", content = {}) {
  const exact = layoutForId(value);
  if (exact) return exact.id;
  const text = [value, kind, content.title, content.subtitle, content.lead]
    .filter(Boolean)
    .join(" ");
  const matched = ALIASES.find(([pattern]) => pattern.test(text));
  if (matched) return matched[1];
  if (kind === "cover") return "cover.editorial";
  if (kind === "tail") return "tail.cta";
  if (kind === "comparison") return "comparison.split";
  if (kind === "process") return "process.timeline";
  if (kind === "framework") return "framework.bento";
  if (kind === "data") return "data.dashboard";
  if (kind === "quote") return "quote.portrait";
  if (kind === "statement") return "statement.poster";
  return "list.cards";
}

export function inferKind(layoutId, fallback = "list") {
  return layoutForId(layoutId)?.kind || fallback;
}

export function layoutOptions() {
  return LAYOUTS.map(({ id, label, kind, maxItems }) => ({ id, label, kind, maxItems }));
}
