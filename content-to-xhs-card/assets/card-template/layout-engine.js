(function () {
  "use strict";

  const DEFAULT_LAYOUTS = [
    { id: "cover.editorial", label: "编辑式封面", kind: "cover", maxItems: 2 },
    { id: "cover.image", label: "图像封面", kind: "cover", maxItems: 2 },
    { id: "statement.poster", label: "单命题海报", kind: "statement", maxItems: 5 },
    { id: "comparison.split", label: "左右镜像对照", kind: "comparison", maxItems: 10 },
    { id: "process.timeline", label: "阶段链", kind: "process", maxItems: 6 },
    { id: "process.cycle", label: "循环闭环", kind: "process", maxItems: 6 },
    { id: "framework.axes", label: "二元轴总览", kind: "framework", maxItems: 5 },
    { id: "framework.matrix", label: "矩阵分类", kind: "framework", maxItems: 16 },
    { id: "framework.bento", label: "Bento 层级", kind: "framework", maxItems: 7 },
    { id: "data.ranking", label: "排名条带", kind: "data", maxItems: 8 },
    { id: "data.dashboard", label: "数据仪表板", kind: "data", maxItems: 8 },
    { id: "list.cards", label: "要点卡组", kind: "list", maxItems: 6 },
    { id: "quote.portrait", label: "人物观点", kind: "quote", maxItems: 2 },
    { id: "tail.cta", label: "收束尾页", kind: "tail", maxItems: 3 }
  ];

  const LEGACY_LAYOUTS = {
    cover: "cover.editorial",
    framework: "process.timeline",
    takeaways: "list.cards",
    section: "list.cards",
    tail: "tail.cta"
  };

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function uid(prefix) {
    return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
  }

  function esc(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function clean(value) {
    return String(value ?? "")
      .replace(/<br\s*\/?\s*>/gi, "\n")
      .replace(/!\[[^\]]*]\([^)]+\)/g, "")
      .replace(/\[([^\]]+)]\([^)]+\)/g, "$1")
      .replace(/[*_`~>#]/g, "")
      .replace(/[ \t]+/g, " ")
      .trim();
  }

  function asItems(value, max = 16) {
    const input = Array.isArray(value) ? value : String(value || "").split(/\r?\n|[；;]/);
    return input.slice(0, max).map((item) => {
      if (typeof item === "string") {
        const [title = "", body = "", val = ""] = clean(item).split(/\s*[｜|]\s*/);
        return { title, body, value: val };
      }
      if (item?.left !== undefined || item?.right !== undefined) {
        return {
          title: `${clean(item.left || "")} ↔ ${clean(item.right || "")}`,
          body: clean(item.body || item.description || ""),
          value: clean(item.value || "")
        };
      }
      return {
        title: clean(item?.title || item?.name || item?.label || ""),
        body: clean(item?.body || item?.text || item?.description || item?.note || ""),
        value: clean(item?.value || "")
      };
    }).filter((item) => item.title || item.body || item.value);
  }

  function textElement(role, frame, text, style = {}, binding = "") {
    return {
      id: uid("text"), type: "text", role, frame, zIndex: style.zIndex || 20,
      visible: true, locked: false, binding,
      content: { text: clean(text) },
      style: {
        fontSize: 36, fontWeight: 700, lineHeight: 1.35, color: "var(--card-ink)",
        align: "left", padding: 0, radius: 0, minFontSize: 20,
        ...style
      }
    };
  }

  function panelElement(role, frame, content, style = {}, binding = "") {
    return {
      id: uid("panel"), type: "panel", role, frame, zIndex: style.zIndex || 12,
      visible: true, locked: false, binding,
      content: {
        label: clean(content?.label || ""),
        title: clean(content?.title || ""),
        body: clean(content?.body || ""),
        items: asItems(content?.items || [], 8)
      },
      style: {
        fill: "var(--card-panel)", border: "var(--card-line)", radius: 30, padding: 34,
        labelFontSize: 30, titleFontSize: 38, bodyFontSize: 28, itemFontSize: 30,
        ...style
      }
    };
  }

  function imageElement(role, frame, src, style = {}) {
    return {
      id: uid("image"), type: "image", role, frame, zIndex: style.zIndex || 10,
      visible: true, locked: false,
      content: { src: src || "", alt: style.alt || "图片" },
      style: { fit: "cover", radius: 28, ...style }
    };
  }

  function visualElement(role, frame, kind, items, style = {}, binding = "items") {
    return {
      id: uid("visual"), type: "visual", role, frame, zIndex: style.zIndex || 10,
      visible: true, locked: false, binding,
      content: { kind, items: asItems(items, 16), dataKey: binding },
      style: { fontScale: 1.5, ...style }
    };
  }

  function shapeElement(role, frame, style = {}) {
    return {
      id: uid("shape"), type: "shape", role, frame, zIndex: style.zIndex || 1,
      visible: true, locked: false, content: {},
      style: { fill: "var(--card-soft)", border: "transparent", borderWidth: 0, radius: 22, ...style }
    };
  }

  function contentTitle(card) {
    return clean(card?.content?.title || card?.title || "");
  }

  function contentItems(card, key = "items") {
    return asItems(card?.content?.[key] || [], 16);
  }

  function commonElements(card, context) {
    const source = clean(card.content?.source || context.source || "");
    const result = [
      textElement("brand", { x: 780, y: 44, width: 236, height: 52, rotation: 0 }, context.brandName || "前面-Aaron", {
        fontSize: 23, fontWeight: 800, lineHeight: 1, color: "#fff", background: "var(--card-accent)",
        padding: 14, radius: 999, align: "center", zIndex: 30, minFontSize: 16
      }),
      textElement("page", { x: 902, y: 1364, width: 116, height: 38, rotation: 0 }, `${String(context.index + 1).padStart(2, "0")} / ${String(context.total).padStart(2, "0")}`, {
        fontSize: 20, fontWeight: 800, lineHeight: 1, color: "var(--card-muted)", align: "right", zIndex: 30
      })
    ];
    if (source) result.push(textElement("source", { x: 64, y: 1360, width: 760, height: 42, rotation: 0 }, `来源：${source}`, {
      fontSize: 18, fontWeight: 600, lineHeight: 1.3, color: "var(--card-muted)", minFontSize: 14
    }, "source"));
    return result;
  }

  function titleBlock(card, frame = { x: 64, y: 126, width: 952, height: 210, rotation: 0 }, fontSize = 68) {
    const title = textElement("title", frame, contentTitle(card), {
      fontSize, fontWeight: 950, lineHeight: 1.16, minFontSize: 38, zIndex: 25
    }, "title");
    const kicker = clean(card.content?.kicker || "");
    return kicker ? [
      textElement("kicker", { x: frame.x, y: frame.y - 54, width: 420, height: 40, rotation: 0 }, kicker, {
        fontSize: 22, fontWeight: 900, lineHeight: 1, color: "var(--card-accent)", minFontSize: 16
      }, "kicker"),
      title
    ] : [title];
  }

  function quotePanel(card, frame, label = "核心判断") {
    const quote = clean(card.content?.quote || card.content?.lead || "");
    if (!quote) return [];
    return [panelElement("quote", frame, { label, body: quote }, {
      fill: "var(--card-panel)", padding: 26, labelFontSize: 30, bodyFontSize: 30
    }, "quote")];
  }

  function factory(card, context) {
    const layoutId = card.layoutId || "list.cards";
    const c = card.content || {};
    const base = commonElements(card, context);
    const items = contentItems(card);
    const avatar = context.assets?.avatar || "";
    const qr = context.assets?.qr || "";

    if (layoutId === "cover.editorial") {
      const elements = [
        ...base,
        ...titleBlock(card, { x: 64, y: 140, width: 952, height: 280, rotation: 0 }, 76),
        textElement("subtitle", { x: 64, y: 432, width: 900, height: 100, rotation: 0 }, c.subtitle || c.lead || "", {
          fontSize: 30, fontWeight: 650, lineHeight: 1.5, color: "var(--card-muted)", minFontSize: 22
        }, "subtitle"),
        shapeElement("accent-line", { x: 64, y: 570, width: 84, height: 10, rotation: 0 }, { fill: "var(--card-accent)", radius: 5 })
      ];
      if (avatar) {
        elements.push(imageElement("hero-image", { x: 610, y: 692, width: 410, height: 630, rotation: 0 }, avatar, { radius: 8 }));
        elements.push(...quotePanel(card, { x: 64, y: 700, width: 510, height: 470, rotation: 0 }));
      } else {
        // 无图封面:让核心判断金句占满主视觉区,不再强塞无意义的占位图形。
        elements.push(...quotePanel(card, { x: 64, y: 690, width: 952, height: 500, rotation: 0 }));
      }
      return elements;
    }

    if (layoutId === "cover.image") {
      return [
        ...base,
        ...titleBlock(card, { x: 64, y: 126, width: 900, height: 280, rotation: 0 }, 72),
        textElement("subtitle", { x: 64, y: 428, width: 920, height: 110, rotation: 0 }, c.subtitle || c.lead || "", {
          fontSize: 29, fontWeight: 650, lineHeight: 1.5, color: "var(--card-muted)", minFontSize: 21
        }, "subtitle"),
        imageElement("hero-image", { x: 574, y: 650, width: 446, height: 674, rotation: 0 }, avatar, { radius: 8 }),
        ...quotePanel(card, { x: 64, y: 686, width: 466, height: 500, rotation: 0 }, c.kicker || "观点")
      ];
    }

    if (layoutId === "statement.poster") {
      const poster = [
        ...base,
        ...titleBlock(card, { x: 64, y: 150, width: 952, height: 340, rotation: 0 }, 84),
        textElement("lead", { x: 64, y: 540, width: 952, height: 200, rotation: 0 }, c.lead || c.subtitle || "", {
          fontSize: 30, fontWeight: 700, lineHeight: 1.55, color: "var(--card-muted)", minFontSize: 24
        }, "lead")
      ];
      const posterQuote = clean(c.quote || "");
      if (posterQuote) {
        poster.push(panelElement("quote", { x: 64, y: 812, width: 952, height: 480, rotation: 0 }, {
          label: c.quoteLabel || "记住", body: posterQuote
        }, {
          fill: "var(--card-accent)", labelFontSize: 30, bodyFontSize: 46,
          labelColor: "#fff", bodyColor: "#fff", padding: 48
        }, "quote"));
      }
      return poster;
    }

    if (layoutId === "comparison.split") {
      const left = c.left || { title: items[0]?.title || "A", items: items.slice(0, Math.ceil(items.length / 2)) };
      const right = c.right || { title: items[Math.ceil(items.length / 2)]?.title || "B", items: items.slice(Math.ceil(items.length / 2)) };
      return [
        ...base,
        ...titleBlock(card, { x: 64, y: 126, width: 952, height: 180, rotation: 0 }, 62),
        panelElement("left-panel", { x: 64, y: 342, width: 454, height: 760, rotation: 0 }, {
          label: left.label || "一侧", title: left.title || "A", body: left.body || "", items: left.items || []
        }, {}, "left"),
        panelElement("right-panel", { x: 562, y: 342, width: 454, height: 760, rotation: 0 }, {
          label: right.label || "另一侧", title: right.title || "B", body: right.body || "", items: right.items || []
        }, { fill: "var(--card-soft)" }, "right"),
        ...quotePanel(card, { x: 64, y: 1130, width: 952, height: 190, rotation: 0 }, "结论")
      ];
    }

    if (layoutId === "process.timeline") {
      return [
        ...base,
        ...titleBlock(card),
        textElement("lead", { x: 64, y: 344, width: 940, height: 92, rotation: 0 }, c.lead || c.subtitle || "", {
          fontSize: 30, fontWeight: 650, lineHeight: 1.45, color: "var(--card-muted)", minFontSize: 22
        }, "lead"),
        visualElement("timeline", { x: 64, y: 470, width: 952, height: 590, rotation: 0 }, "timeline", items, {}, "items"),
        ...quotePanel(card, { x: 64, y: 1090, width: 952, height: 230, rotation: 0 }, "收束")
      ];
    }

    if (layoutId === "process.cycle") {
      return [
        ...base,
        ...titleBlock(card),
        textElement("lead", { x: 64, y: 340, width: 940, height: 80, rotation: 0 }, c.lead || "", {
          fontSize: 30, fontWeight: 650, lineHeight: 1.4, color: "var(--card-muted)", minFontSize: 22
        }, "lead"),
        visualElement("cycle", { x: 144, y: 438, width: 792, height: 650, rotation: 0 }, "cycle", items, {}, "items"),
        ...quotePanel(card, { x: 96, y: 1110, width: 888, height: 210, rotation: 0 }, "系统价值")
      ];
    }

    if (layoutId === "framework.axes") {
      const axes = asItems(c.axes || items, 5).map((item) => ({
        title: item.title || item.left || "左侧",
        body: item.body || item.right || "右侧",
        value: item.value || ""
      }));
      return [
        ...base,
        ...titleBlock(card),
        textElement("lead", { x: 64, y: 338, width: 940, height: 90, rotation: 0 }, c.lead || c.subtitle || "", {
          fontSize: 30, fontWeight: 650, lineHeight: 1.45, color: "var(--card-muted)", minFontSize: 22
        }, "lead"),
        visualElement("axes", { x: 64, y: 460, width: 952, height: 650, rotation: 0 }, "axes", axes, {}, "axes"),
        ...quotePanel(card, { x: 64, y: 1130, width: 952, height: 190, rotation: 0 }, "判断")
      ];
    }

    if (layoutId === "framework.matrix") {
      const matrixItems = contentItems(card, "matrix").length ? contentItems(card, "matrix") : items;
      return [
        ...base,
        ...titleBlock(card, { x: 64, y: 120, width: 952, height: 164, rotation: 0 }, 58),
        textElement("lead", { x: 64, y: 300, width: 940, height: 76, rotation: 0 }, c.lead || c.subtitle || "", {
          fontSize: 30, fontWeight: 650, lineHeight: 1.4, color: "var(--card-muted)", minFontSize: 22
        }, "lead"),
        visualElement("matrix", { x: 64, y: 398, width: 952, height: 750, rotation: 0 }, "matrix", matrixItems, {}, "matrix"),
        ...quotePanel(card, { x: 64, y: 1170, width: 952, height: 154, rotation: 0 }, "核心")
      ];
    }

    if (layoutId === "framework.bento") {
      return [
        ...base,
        ...titleBlock(card),
        textElement("lead", { x: 64, y: 342, width: 940, height: 84, rotation: 0 }, c.lead || c.subtitle || "", {
          fontSize: 30, fontWeight: 650, lineHeight: 1.4, color: "var(--card-muted)", minFontSize: 22
        }, "lead"),
        visualElement("bento", { x: 64, y: 458, width: 952, height: 680, rotation: 0 }, "bento", items, {}, "items"),
        ...quotePanel(card, { x: 64, y: 1160, width: 952, height: 164, rotation: 0 }, "主线")
      ];
    }

    if (layoutId === "data.ranking") {
      const ranking = contentItems(card, "stats").length ? contentItems(card, "stats") : items;
      return [
        ...base,
        ...titleBlock(card, { x: 64, y: 120, width: 952, height: 174, rotation: 0 }, 58),
        textElement("lead", { x: 64, y: 310, width: 940, height: 74, rotation: 0 }, c.lead || c.subtitle || "", {
          fontSize: 30, fontWeight: 650, lineHeight: 1.4, color: "var(--card-muted)", minFontSize: 22
        }, "lead"),
        visualElement("ranking", { x: 64, y: 414, width: 952, height: 720, rotation: 0 }, "ranking", ranking, {}, "stats"),
        ...quotePanel(card, { x: 64, y: 1160, width: 952, height: 166, rotation: 0 }, "注")
      ];
    }

    if (layoutId === "data.dashboard") {
      const stats = contentItems(card, "stats").length ? contentItems(card, "stats") : items;
      return [
        ...base,
        ...titleBlock(card, { x: 64, y: 120, width: 952, height: 174, rotation: 0 }, 58),
        textElement("lead", { x: 64, y: 310, width: 940, height: 74, rotation: 0 }, c.lead || c.subtitle || "", {
          fontSize: 30, fontWeight: 650, lineHeight: 1.4, color: "var(--card-muted)", minFontSize: 22
        }, "lead"),
        visualElement("dashboard", { x: 64, y: 410, width: 952, height: 720, rotation: 0 }, "dashboard", stats, {}, "stats"),
        ...quotePanel(card, { x: 64, y: 1158, width: 952, height: 168, rotation: 0 }, "判断")
      ];
    }

    if (layoutId === "quote.portrait") {
      return [
        ...base,
        ...titleBlock(card, { x: 64, y: 126, width: 952, height: 220, rotation: 0 }, 64),
        imageElement("portrait", { x: 575, y: 430, width: 445, height: 840, rotation: 0 }, avatar, { radius: 8 }),
        panelElement("quote", { x: 64, y: 468, width: 470, height: 620, rotation: 0 }, {
          label: c.kicker || "人物观点", title: c.subtitle || "", body: c.quote || c.lead || ""
        }, {}, "quote"),
        textElement("caption", { x: 64, y: 1112, width: 470, height: 120, rotation: 0 }, c.cta || "", {
          fontSize: 25, fontWeight: 700, lineHeight: 1.5, color: "var(--card-muted)", minFontSize: 18
        }, "cta")
      ];
    }

    if (layoutId === "tail.cta") {
      const result = [
        ...base,
        textElement("kicker", { x: 64, y: 140, width: 420, height: 48, rotation: 0 }, c.kicker || "写在最后", {
          fontSize: 24, fontWeight: 900, lineHeight: 1, color: "var(--card-accent)", minFontSize: 18
        }, "kicker"),
        textElement("title", { x: 64, y: 224, width: 952, height: 320, rotation: 0 }, c.quote || contentTitle(card), {
          fontSize: 72, fontWeight: 950, lineHeight: 1.2, minFontSize: 38
        }, "quote"),
        textElement("cta", { x: 64, y: 610, width: 650, height: 190, rotation: 0 }, c.cta || c.subtitle || "", {
          fontSize: 34, fontWeight: 750, lineHeight: 1.5, color: "var(--card-muted)", minFontSize: 24
        }, "cta")
      ];
      if (qr) result.push(imageElement("qr", { x: 760, y: 924, width: 256, height: 256, rotation: 0 }, qr, { fit: "contain", radius: 8 }));
      result.push(textElement("signature", { x: 64, y: 1000, width: 620, height: 170, rotation: 0 }, `${context.brandName || "前面-Aaron"}\n持续分享 AI、创作与金融科技观察`, {
        fontSize: 30, fontWeight: 800, lineHeight: 1.55, minFontSize: 22
      }));
      return result;
    }

    const cards = items.length ? items.slice(0, 6) : [{ title: c.lead || c.subtitle || "正文", body: c.quote || "" }];
    // 根据要点数量动态分行,行高均分,避免 5~6 项时末行被压扁、正文溢出画布。
    const gridTop = 410, gridBottom = 1312, gridGap = 30, colW = 456;
    const rowCount = Math.ceil(cards.length / 2) || 1;
    const rowH = Math.min(360, (gridBottom - gridTop - gridGap * (rowCount - 1)) / rowCount);
    const positions = cards.map((_, index) => ({
      x: index % 2 === 0 ? 64 : 560,
      y: gridTop + Math.floor(index / 2) * (rowH + gridGap),
      width: colW,
      height: rowH
    }));
    return [
      ...base,
      ...titleBlock(card),
      textElement("lead", { x: 64, y: 338, width: 940, height: 58, rotation: 0 }, c.lead || c.subtitle || "", {
        fontSize: 30, fontWeight: 650, lineHeight: 1.35, color: "var(--card-muted)", minFontSize: 22
      }, "lead"),
      ...cards.map((item, index) => panelElement(`item-${index + 1}`, { ...positions[index], rotation: 0 }, {
        label: String(index + 1).padStart(2, "0"), title: item.title, body: item.body
      }, { fill: index % 3 === 1 ? "var(--card-soft)" : "var(--card-panel)", padding: rowH < 300 ? 22 : 30 }, `items.${index}`))
    ];
  }

  function normalizeCard(raw, order) {
    if (raw?.layoutId || raw?.content || raw?.elements) {
      const layoutId = raw.layoutId || raw.layout || "list.cards";
      return {
        ...raw,
        id: raw.id || `card-${String(order + 1).padStart(2, "0")}`,
        kind: raw.kind || DEFAULT_LAYOUTS.find((layout) => layout.id === layoutId)?.kind || "list",
        layoutId,
        themeId: raw.themeId || "warm-editorial",
        content: { ...(raw.content || {}), title: clean(raw.content?.title ?? raw.title ?? "") },
        removedRoles: Array.isArray(raw.removedRoles) ? raw.removedRoles : []
      };
    }
    const type = raw?.type || "section";
    const items = asItems(raw?.items || raw?.bullets || raw?.steps || [], 16);
    const relationText = `${clean(raw?.title || "")} ${clean(raw?.lead || raw?.insight || "")} ${clean(raw?.quote || "")}`;
    const legacyTitle = clean(raw?.title || "");
    let layoutId = LEGACY_LAYOUTS[type] || "list.cards";
    if (type === "section" || type === "takeaways") {
      if (/怎样|流程|步骤|阶段|节点|要过.+关/.test(legacyTitle)) layoutId = "process.timeline";
      else if (/工作现场|系统|地图|构成|能力|企业需要/.test(legacyTitle)) layoutId = "framework.bento";
      else if (/两类|对比|区别|不是.+而是|不必/.test(relationText)) layoutId = "comparison.split";
      else if (/怎样|流程|步骤|阶段|节点|要过.+关/.test(relationText)) layoutId = "process.timeline";
      else if (/工作现场|系统|地图|构成|能力|企业需要/.test(relationText)) layoutId = "framework.bento";
      else if (/不要卖|核心命题|本质/.test(relationText)) layoutId = "statement.poster";
    }
    return {
      id: raw?.id || `card-${String(order + 1).padStart(2, "0")}`,
      kind: type === "takeaways" || type === "section" ? "list" : type,
      layoutId,
      themeId: "warm-editorial",
      content: {
        title: clean(raw?.title || ""), subtitle: clean(raw?.subtitle || ""),
        lead: clean(raw?.lead || raw?.insight || ""), quote: clean(raw?.quote || ""),
        cta: clean(raw?.cta || ""), items
      },
      removedRoles: [],
      meta: { ...(raw?.meta || {}), migratedFrom: "v1", legacyType: type }
    };
  }

  function fallbackDeck(markdown) {
    const cleaned = String(markdown || "").replace(/^---[\s\S]*?---\s*/, "");
    const title = clean(cleaned.match(/^#\s+(.+)$/m)?.[1] || "内容卡片");
    const paragraphs = cleaned.split(/\n\s*\n/).map(clean).filter((text) => text && text !== title && text.length > 24);
    const groups = [paragraphs.slice(0, 4), paragraphs.slice(4, 8)];
    return {
      schemaVersion: 2,
      id: uid("deck"), title, canvas: { width: 1080, height: 1440 },
      cards: [
        { id: "card-01", kind: "cover", layoutId: "cover.editorial", themeId: "warm-editorial", content: { title, subtitle: paragraphs[0] || "", quote: paragraphs[1] || "" } },
        ...groups.filter((group) => group.length).map((group, index) => ({
          id: `card-${String(index + 2).padStart(2, "0")}`, kind: "list", layoutId: "list.cards", themeId: "warm-editorial",
          content: { title: `核心内容 ${index + 1}`, items: group.map((body, itemIndex) => ({ title: `要点 ${itemIndex + 1}`, body })) }
        })),
        { id: "card-04", kind: "tail", layoutId: "tail.cta", themeId: "warm-editorial", content: { title: "写在最后", quote: paragraphs.at(-1) || title, cta: "前面-Aaron" } }
      ]
    };
  }

  const PUBLICATION_META_PATTERN = /这组卡片|顺着卡片|把卡片|卡片主要|本文将|一起来看看|建议收藏|家人们|传播主线|逐步拆开|先记住/;

  function publicationSentence(value, max = 110) {
    const text = clean(value).replace(/^主线[，,:：]\s*/, "").replace(/^[：:；;、，,\s]+|[：:；;、，,\s]+$/g, "").slice(0, max);
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
      .flatMap((value) => clean(value).split(/[；;]\s*/))
      .map((value) => publicationSentence(value, 100))
      .filter(Boolean)
      .filter((item, index, list) => item !== thesis && list.indexOf(item) === index)
      .slice(0, 5);
    const middle = candidates.slice(0, 2).map((item) => item.replace(/[。！？!?]$/, "")).join("，进而");
    return [thesis, middle ? `${middle}。` : "", candidates.slice(2).join("")]
      .filter(Boolean)
      .join("\n\n")
      .slice(0, 240);
  }

  function defaultPublication(title, cards) {
    const cleanTitle = clean(title);
    const isTwoAi = /有些\s*AI.+有些\s*AI/i.test(cleanTitle);
    const original = cleanTitle.length <= 20 ? cleanTitle : "";
    // 从卡片正文提炼一个"结论型"标题:取最短的完整判断句,去掉标点。
    const claims = cards
      .filter((card) => !["cover", "tail"].includes(card.kind))
      .flatMap((card) => {
        const content = card.content || {};
        const itemText = [...(content.items || []), ...(content.matrix || []), ...(content.stats || [])]
          .map((item) => typeof item === "string" ? item : [item.title || item.label, item.body || item.value].filter(Boolean).join("："));
        return [content.quote, content.lead, ...itemText, content.subtitle];
      })
      .map(clean)
      .filter(Boolean);
    const conclusion = claims
      .map((item) => clean(item).replace(/[。！？!?、，,；;：:“”"']/g, "").trim())
      .filter((item) => item.length >= 8 && item.length <= 20)
      .sort((a, b) => a.length - b.length)[0] || "";
    // 生成式初稿:优先用原标题与卡片结论,不再套用"N张图看懂/重新理解"模板。
    // 提醒:以下多为占位,模型须按 references/publication-copy.md 用原文观点重写。
    const candidates = isTwoAi
      ? [
          "交付结果和理解你,是两种 AI",
          "选 AI 前,先看它默认为谁服务",
          "为什么有的 AI 越用越懂你",
          "两类 AI,差别不在能力在目标",
          "别拿一种 AI 的标准要求另一种",
        ]
      : [original, conclusion];
    return {
      titles: candidates.map((item) => clean(item).slice(0, 20)).filter((item, index, list) => item && list.indexOf(item) === index).slice(0, 5),
      body: publicationBody(title, cards)
    };
  }

  function normalizePublication(source, title, cards) {
    if (!Object.prototype.hasOwnProperty.call(source, "publication")) return defaultPublication(title, cards);
    return {
      titles: (Array.isArray(source.publication?.titles) ? source.publication.titles : []).map(clean).filter(Boolean).slice(0, 5),
      body: clean(source.publication?.body || "").slice(0, 500)
    };
  }

  function normalizeDeck(raw, markdown) {
    const source = raw && Array.isArray(raw.cards) ? clone(raw) : fallbackDeck(markdown);
    const cards = source.cards.map(normalizeCard);
    const title = clean(source.title || source.meta?.title || cards[0]?.content?.title || "内容卡片");
    return {
      ...source,
      schemaVersion: 2,
      id: source.id || uid("deck"),
      title,
      source: clean(source.source || source.meta?.source || ""),
      canvas: { width: 1080, height: 1440, ...(source.canvas || {}) },
      publication: normalizePublication(source, title, cards),
      cards
    };
  }

  function materializeCard(card, context, force = false) {
    if (!force && Array.isArray(card.elements) && card.elements.length) return card.elements;
    const removed = new Set(card.removedRoles || []);
    card.elements = factory(card, context).filter((element) => !removed.has(element.role));
    return card.elements;
  }

  function renderText(element) {
    const s = element.style || {};
    const style = [
      `font-size:${Number(s.fontSize || 36)}px`, `font-weight:${s.fontWeight || 700}`,
      `line-height:${s.lineHeight || 1.35}`, `color:${s.color || "var(--card-ink)"}`,
      `text-align:${s.align || "left"}`, `padding:${Number(s.padding || 0)}px`,
      `border-radius:${Number(s.radius || 0)}px`, `background:${s.background || "transparent"}`,
      `border:${s.border || "0"}`
    ].join(";");
    return `<div class="element-text fit-text" data-min-font="${Number(s.minFontSize || 16)}" style="${style}">${esc(element.content?.text || "").replaceAll("\n", "<br>")}</div>`;
  }

  function renderPanel(element) {
    const c = element.content || {};
    const s = element.style || {};
    const items = asItems(c.items || [], 8);
    return `<div class="element-panel" style="padding:${Number(s.padding || 30)}px;background:${s.fill || "var(--card-panel)"};border-color:${s.border || "var(--card-line)"};border-radius:${Number(s.radius ?? 8)}px;--panel-label-size:${Number(s.labelFontSize || 30)}px;--panel-title-size:${Number(s.titleFontSize || 38)}px;--panel-body-size:${Number(s.bodyFontSize || 28)}px;--panel-item-size:${Number(s.itemFontSize || 30)}px">
      ${c.label ? `<span class="panel-label"${s.labelColor ? ` style="color:${s.labelColor};background:${s.labelBg || "rgba(255,255,255,.22)"}"` : ""}>${esc(c.label)}</span>` : ""}
      ${c.title ? `<h3 class="panel-heading"${s.titleColor ? ` style="color:${s.titleColor}"` : ""}>${esc(c.title)}</h3>` : ""}
      ${c.body ? `<p class="panel-body"${s.bodyColor ? ` style="color:${s.bodyColor}"` : ""}>${esc(c.body).replaceAll("\n", "<br>")}</p>` : ""}
      ${items.length ? `<ul class="panel-items"${s.bodyColor ? ` style="color:${s.bodyColor}"` : ""}>${items.map((item) => `<li><div><strong>${esc(item.title)}</strong>${item.body ? `<br><span>${esc(item.body)}</span>` : ""}</div></li>`).join("")}</ul>` : ""}
    </div>`;
  }

  function htmlInSvg(x, y, width, height, html, style = "") {
    return `<foreignObject x="${x}" y="${y}" width="${width}" height="${height}"><div xmlns="http://www.w3.org/1999/xhtml" style="width:100%;height:100%;overflow:hidden;${style}">${html}</div></foreignObject>`;
  }

  function scaledFont(base, scale = 1) {
    return Math.max(10, Math.round(Number(base) * Math.max(.6, Math.min(1.8, Number(scale) || 1))));
  }

  function visualTimeline(items, width, height, fontScale = 1) {
    const data = asItems(items, 6);
    const count = Math.max(1, data.length);
    const gap = width / count;
    const y = Math.round(height * .31);
    return `<svg viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
      <line x1="${gap / 2}" y1="${y}" x2="${width - gap / 2}" y2="${y}" class="visual-line" stroke-width="8"/>
      ${data.map((item, index) => {
        const x = gap * index + gap / 2;
        return `<circle cx="${x}" cy="${y}" r="42" class="visual-accent"/>
          <text x="${x}" y="${y + 10}" text-anchor="middle" font-size="${scaledFont(28, fontScale)}" font-weight="900" fill="#fff">${String(index + 1).padStart(2, "0")}</text>
          ${htmlInSvg(Math.max(0, x - gap * .43), y + 72, gap * .86, height - y - 80,
            `<div style="font-size:${scaledFont(30, fontScale)}px;font-weight:900;line-height:1.25;color:var(--card-ink);text-align:center">${esc(item.title)}</div><div style="margin-top:12px;font-size:${scaledFont(22, fontScale)}px;line-height:1.45;color:var(--card-muted);text-align:center">${esc(item.body)}</div>`)} `;
      }).join("")}
    </svg>`;
  }

  function visualAxes(items, width, height, fontScale = 1) {
    const data = asItems(items, 5);
    const rowH = height / Math.max(1, data.length);
    return `<svg viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">${data.map((item, index) => {
      const y = index * rowH;
      const [left, right] = item.title.includes("↔") ? item.title.split("↔") : [item.title, item.body];
      return `<rect x="0" y="${y + 8}" width="${width}" height="${rowH - 16}" rx="22" class="visual-panel"/>
        <line x1="${width * .28}" y1="${y + rowH * .52}" x2="${width * .72}" y2="${y + rowH * .52}" class="visual-line" stroke-width="6"/>
        <circle cx="${width * .5}" cy="${y + rowH * .52}" r="14" class="visual-accent"/>
        ${item.body ? htmlInSvg(width * .38, y + 10, width * .24, rowH * .28, `<div style="height:100%;display:flex;align-items:center;justify-content:center;text-align:center;font-size:${scaledFont(19, fontScale)}px;font-weight:850;color:var(--card-accent)">${esc(item.body)}</div>`) : ""}
        ${htmlInSvg(26, y + 24, width * .25, rowH - 40, `<div style="font-size:${scaledFont(30, fontScale)}px;font-weight:900;line-height:1.25;color:var(--card-ink);display:flex;align-items:center;height:100%">${esc(left)}</div>`)}
        ${htmlInSvg(width * .73, y + 24, width * .24, rowH - 40, `<div style="font-size:${scaledFont(30, fontScale)}px;font-weight:900;line-height:1.25;color:var(--card-ink);display:flex;align-items:center;justify-content:flex-end;text-align:right;height:100%">${esc(right || item.value)}</div>`)}`;
    }).join("")}</svg>`;
  }

  function visualMatrix(items, width, height, fontScale = 1) {
    const data = asItems(items, 16);
    const columns = data.length > 9 ? 4 : data.length > 4 ? 3 : 2;
    const rows = Math.ceil(data.length / columns) || 1;
    const gap = 14;
    const cellW = (width - gap * (columns - 1)) / columns;
    const cellH = (height - gap * (rows - 1)) / rows;
    return `<svg viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">${data.map((item, index) => {
      const x = (index % columns) * (cellW + gap);
      const y = Math.floor(index / columns) * (cellH + gap);
      const fillClass = index % 4 === 0 ? "visual-accent" : index % 4 === 1 ? "visual-panel" : index % 4 === 2 ? "visual-accent-2" : "visual-accent-3";
      const dark = index % 4 !== 1;
      return `<rect x="${x}" y="${y}" width="${cellW}" height="${cellH}" rx="22" class="${fillClass}" opacity="${dark ? .92 : 1}"/>
        ${htmlInSvg(x + 18, y + 18, cellW - 36, cellH - 36,
          `<div style="font-size:${scaledFont(columns === 4 ? 22 : 28, fontScale)}px;font-weight:900;line-height:1.25;color:${dark ? "#fff" : "var(--card-ink)"}">${esc(item.title)}</div><div style="margin-top:8px;font-size:${scaledFont(columns === 4 ? 16 : 20, fontScale)}px;line-height:1.4;color:${dark ? "rgba(255,255,255,.88)" : "var(--card-muted)"}">${esc(item.body || item.value)}</div>`)} `;
    }).join("")}</svg>`;
  }

  function visualBento(items, width, height, fontScale = 1) {
    const data = asItems(items, 7);
    const slots = [
      [0, 0, .57, .48], [.59, 0, .41, .48], [0, .51, .31, .49], [.33, .51, .33, .49], [.68, .51, .32, .49]
    ];
    return `<svg viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">${data.slice(0, 5).map((item, index) => {
      const slot = slots[index];
      const x = slot[0] * width, y = slot[1] * height, w = slot[2] * width, h = slot[3] * height;
      const className = index === 0 ? "visual-accent" : index === 1 ? "visual-accent-2" : "visual-panel";
      const dark = index < 2;
      return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="22" class="${className}"/>
        ${htmlInSvg(x + 24, y + 24, w - 48, h - 48, `<div style="font-size:${scaledFont(index === 0 ? 36 : 28, fontScale)}px;font-weight:950;line-height:1.2;color:${dark ? "#fff" : "var(--card-ink)"}">${esc(item.title)}</div><div style="margin-top:14px;font-size:${scaledFont(index === 0 ? 25 : 21, fontScale)}px;line-height:1.5;color:${dark ? "rgba(255,255,255,.88)" : "var(--card-muted)"}">${esc(item.body || item.value)}</div>`)} `;
    }).join("")}</svg>`;
  }

  function visualRanking(items, width, height, fontScale = 1) {
    const data = asItems(items, 8);
    const numbers = data.map((item) => Number.parseFloat(String(item.value || item.body).replace(/[^\d.-]/g, "")) || 0);
    const max = Math.max(...numbers, 1);
    const rowH = height / Math.max(1, data.length);
    return `<svg viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">${data.map((item, index) => {
      const y = index * rowH;
      const barW = Math.max(70, (numbers[index] / max) * width * .52);
      return `<rect x="0" y="${y + 7}" width="${width}" height="${rowH - 14}" rx="22" class="visual-panel"/>
        <circle cx="${42}" cy="${y + rowH / 2}" r="26" fill="${index < 3 ? "var(--card-accent)" : "var(--card-soft)"}"/>
        <text x="42" y="${y + rowH / 2 + 9}" text-anchor="middle" font-size="${scaledFont(24, fontScale)}" font-weight="900" fill="${index < 3 ? "#fff" : "var(--card-ink)"}">${index + 1}</text>
        ${htmlInSvg(86, y + 16, width * .28, rowH - 28, `<div style="height:100%;display:flex;align-items:center;font-size:${scaledFont(27, fontScale)}px;font-weight:900;color:var(--card-ink)">${esc(item.title)}</div>`)}
        <rect x="${width * .38}" y="${y + rowH * .34}" width="${barW}" height="${rowH * .32}" rx="10" fill="${index === 0 ? "var(--card-accent)" : index === 1 ? "var(--card-accent-2)" : "var(--card-accent-3)"}" opacity="${Math.max(.45, 1 - index * .07)}"/>
        ${htmlInSvg(width * .75, y + 16, width * .22, rowH - 28, `<div style="height:100%;display:flex;align-items:center;justify-content:flex-end;text-align:right;font-size:${scaledFont(24, fontScale)}px;font-weight:900;color:var(--card-ink)">${esc(item.value || item.body)}</div>`)}`;
    }).join("")}</svg>`;
  }

  function visualDashboard(items, width, height, fontScale = 1) {
    const data = asItems(items, 8);
    const top = data.slice(0, 3);
    const rest = data.slice(3, 8);
    const numbers = rest.map((item) => Number.parseFloat(String(item.value || item.body).replace(/[^\d.-]/g, "")) || 0);
    const max = Math.max(...numbers, 1);
    return `<svg viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
      ${top.map((item, index) => {
        const cardW = (width - 28) / 3;
        const x = index * (cardW + 14);
        return `<rect x="${x}" y="0" width="${cardW}" height="${height * .28}" rx="22" class="${index === 0 ? "visual-accent" : "visual-panel"}"/>
        ${htmlInSvg(x + 22, 22, cardW - 44, height * .28 - 44, `<div style="font-size:${scaledFont(23, fontScale)}px;font-weight:800;color:${index === 0 ? "#fff" : "var(--card-muted)"}">${esc(item.title)}</div><div style="margin-top:18px;font-size:${scaledFont(42, fontScale)}px;font-weight:950;color:${index === 0 ? "#fff" : "var(--card-ink)"}">${esc(item.value || item.body)}</div>`)} `;
      }).join("")}
      <rect x="0" y="${height * .32}" width="${width}" height="${height * .68}" rx="22" class="visual-panel"/>
      ${rest.map((item, index) => {
        const y = height * .38 + index * (height * .11);
        const barW = Math.max(30, (numbers[index] / max) * width * .54);
        return `${htmlInSvg(24, y - 6, width * .27, height * .09, `<div style="height:100%;display:flex;align-items:center;font-size:${scaledFont(23, fontScale)}px;font-weight:850;color:var(--card-ink)">${esc(item.title)}</div>`)}
          <rect x="${width * .31}" y="${y + 12}" width="${barW}" height="26" rx="9" fill="var(--card-accent-2)"/>
          ${htmlInSvg(width * .83, y - 6, width * .14, height * .09, `<div style="height:100%;display:flex;align-items:center;justify-content:flex-end;font-size:${scaledFont(21, fontScale)}px;font-weight:900;color:var(--card-ink)">${esc(item.value || item.body)}</div>`)}`;
      }).join("")}
    </svg>`;
  }

  function visualCycle(items, width, height, fontScale = 1) {
    const data = asItems(items, 6);
    const count = Math.max(1, data.length);
    const cx = width / 2, cy = height / 2, radius = Math.min(width, height) * .34;
    const nodes = data.map((item, index) => {
      const angle = -Math.PI / 2 + index * Math.PI * 2 / count;
      return { item, x: cx + Math.cos(angle) * radius, y: cy + Math.sin(angle) * radius };
    });
    return `<svg viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
      <defs><marker id="cycle-arrow" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M 0 0 L 10 5 L 0 10 z" fill="var(--card-accent-2)"/></marker></defs>
      ${nodes.map((node, index) => {
        const next = nodes[(index + 1) % nodes.length];
        return `<line x1="${node.x}" y1="${node.y}" x2="${next.x}" y2="${next.y}" stroke="var(--card-accent-2)" stroke-width="6" marker-end="url(#cycle-arrow)"/>`;
      }).join("")}
      <circle cx="${cx}" cy="${cy}" r="${radius * .42}" fill="var(--card-soft)"/>
      <text x="${cx}" y="${cy + 12}" text-anchor="middle" font-size="${scaledFont(34, fontScale)}" font-weight="950" fill="var(--card-ink)">持续复盘</text>
      ${nodes.map((node, index) => `<circle cx="${node.x}" cy="${node.y}" r="70" fill="${index % 2 ? "var(--card-accent-2)" : "var(--card-accent)"}"/>
        ${htmlInSvg(node.x - 58, node.y - 46, 116, 92, `<div style="height:100%;display:flex;align-items:center;justify-content:center;text-align:center;font-size:${scaledFont(22, fontScale)}px;font-weight:900;line-height:1.25;color:#fff">${esc(node.item.title)}</div>`)}`).join("")}
    </svg>`;
  }

  function visualConcept(items, width, height, fontScale = 1) {
    const data = asItems(items, 5);
    const cx = width / 2, cy = height / 2;
    return `<svg viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
      <rect x="2" y="2" width="${width - 4}" height="${height - 4}" rx="22" fill="none" stroke="var(--card-line)" stroke-width="3"/>
      <circle cx="${cx}" cy="${cy}" r="${Math.min(width, height) * .31}" fill="var(--card-soft)"/>
      <circle cx="${cx}" cy="${cy}" r="${Math.min(width, height) * .18}" fill="var(--card-accent)"/>
      ${htmlInSvg(cx - 100, cy - 52, 200, 104, `<div style="height:100%;display:flex;align-items:center;justify-content:center;text-align:center;font-size:${scaledFont(30, fontScale)}px;font-weight:950;line-height:1.2;color:#fff">${esc(data[0]?.title || "核心")}</div>`)}
      ${data.slice(1, 5).map((item, index) => {
        const angle = -Math.PI / 2 + index * Math.PI / 2;
        const x = cx + Math.cos(angle) * Math.min(width, height) * .38;
        const y = cy + Math.sin(angle) * Math.min(width, height) * .38;
        return `<circle cx="${x}" cy="${y}" r="52" fill="var(--card-panel)" stroke="var(--card-accent-2)" stroke-width="4"/>
          ${htmlInSvg(x - 46, y - 34, 92, 68, `<div style="height:100%;display:flex;align-items:center;justify-content:center;text-align:center;font-size:${scaledFont(19, fontScale)}px;font-weight:900;line-height:1.2;color:var(--card-ink)">${esc(item.title)}</div>`)}`;
      }).join("")}
    </svg>`;
  }

  function renderVisual(element) {
    const width = Math.max(10, Number(element.frame?.width || 400));
    const height = Math.max(10, Number(element.frame?.height || 400));
    const items = element.content?.items || [];
    const kind = element.content?.kind || "timeline";
    const fontScale = Math.max(.6, Math.min(1.8, Number(element.style?.fontScale || 1.5)));
    const renderers = {
      timeline: visualTimeline, axes: visualAxes, matrix: visualMatrix, bento: visualBento,
      ranking: visualRanking, dashboard: visualDashboard, cycle: visualCycle, concept: visualConcept
    };
    return `<div class="element-visual">${(renderers[kind] || visualTimeline)(items, width, height, fontScale)}</div>`;
  }

  function renderElement(element, selected) {
    if (element.visible === false) return "";
    const frame = element.frame || {};
    const style = [
      `left:${Number(frame.x || 0)}px`, `top:${Number(frame.y || 0)}px`,
      `width:${Number(frame.width || 100)}px`, `height:${Number(frame.height || 100)}px`,
      `z-index:${Number(element.zIndex || 1)}`, `transform:rotate(${Number(frame.rotation || 0)}deg)`
    ].join(";");
    let body = "";
    if (element.type === "text") body = renderText(element);
    else if (element.type === "panel") body = renderPanel(element);
    else if (element.type === "image") body = element.content?.src
      ? `<img class="element-image" src="${esc(element.content.src)}" alt="${esc(element.content.alt || "图片")}" style="object-fit:${esc(element.style?.fit || "cover")};border-radius:${Number(element.style?.radius ?? 8)}px">`
      : `<div class="element-panel" style="display:grid;place-items:center;color:var(--card-muted)">选择图片</div>`;
    else if (element.type === "visual") body = renderVisual(element);
    else body = `<div class="element-shape" style="background:${element.style?.fill || "var(--card-soft)"};border:${Number(element.style?.borderWidth || 0)}px solid ${element.style?.border || "transparent"};border-radius:${Number(element.style?.radius ?? 8)}px"></div>`;
    const handles = selected && !element.locked
      ? '<span class="resize-handle resize-handle-right" data-resize-handle="width" title="调整宽度"></span><span class="resize-handle resize-handle-bottom" data-resize-handle="height" title="调整高度"></span><span class="resize-handle resize-handle-corner" data-resize-handle="both" title="同时调整宽高"></span>'
      : "";
    const roleClass = element.type === "panel" && element.role === "quote" ? " panel-quote" : "";
    return `<div class="canvas-element${roleClass}${selected ? " is-selected" : ""}${element.locked ? " is-locked" : ""}" data-element-id="${esc(element.id)}" data-role="${esc(element.role || "")}" style="${style}">${body}${handles}</div>`;
  }

  function fitText(scene) {
    scene.querySelectorAll(".fit-text").forEach((node) => {
      const min = Number(node.dataset.minFont || 16);
      let size = Number.parseFloat(node.style.fontSize) || 36;
      while ((node.scrollHeight > node.clientHeight + 1 || node.scrollWidth > node.clientWidth + 1) && size > min) {
        size -= 2;
        node.style.fontSize = `${size}px`;
      }
      node.dataset.overflow = node.scrollHeight > node.clientHeight + 2 || node.scrollWidth > node.clientWidth + 2 ? "true" : "false";
    });
  }

  function fitQuotePanels(scene) {
    scene.querySelectorAll(".panel-quote .element-panel").forEach((panel) => {
      const body = panel.querySelector(".panel-body");
      if (!body) return;
      let size = Number.parseFloat(getComputedStyle(body).fontSize) || 30;
      while (panel.scrollHeight > panel.clientHeight + 2 && size > 22) {
        size -= 1;
        panel.style.setProperty("--panel-body-size", `${size}px`);
      }
      if (panel.scrollHeight > panel.clientHeight + 2) {
        panel.style.padding = "20px";
        panel.style.setProperty("--panel-label-size", "26px");
      }
    });
  }

  function renderScene(scene, card, selectedElementId) {
    scene.className = `card-scene theme-${card.themeId || "warm-editorial"}`;
    const elements = [...(card.elements || [])].sort((a, b) => Number(a.zIndex || 0) - Number(b.zIndex || 0));
    scene.innerHTML = elements.map((element) => renderElement(element, element.id === selectedElementId)).join("");
    fitText(scene);
    fitQuotePanels(scene);
    scene.querySelectorAll(".element-panel").forEach((node) => {
      node.dataset.overflow = node.scrollHeight > node.clientHeight + 2 || node.scrollWidth > node.clientWidth + 2 ? "true" : "false";
    });
    return scene.querySelectorAll('[data-overflow="true"]').length;
  }

  function layoutRegistry(custom) {
    return Array.isArray(custom) && custom.length ? custom : DEFAULT_LAYOUTS;
  }

  window.CardEngine = {
    DEFAULT_LAYOUTS, asItems, clean, clone, esc, fallbackDeck, factory, fitText, layoutRegistry,
    materializeCard, normalizeCard, normalizeDeck, panelElement, renderScene, shapeElement,
    textElement, uid, visualElement, imageElement
  };
})();
