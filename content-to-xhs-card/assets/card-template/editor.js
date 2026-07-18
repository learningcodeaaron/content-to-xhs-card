(async function () {
  "use strict";

  const Engine = window.CardEngine;
  const layouts = Engine.layoutRegistry(BOOTSTRAP.layoutRegistry);
  const layoutMap = new Map(layouts.map((layout) => [layout.id, layout]));
  const state = {
    deck: Engine.normalizeDeck(BOOTSTRAP.deck, BOOTSTRAP.markdown),
    config: { brandName: "前面-Aaron", brandUrl: "https://nextwaylab.com/", exportScale: 1, tailAsset: "brandIcon", ...(BOOTSTRAP.config || {}) },
    assets: { ...(BOOTSTRAP.assets || {}) },
    selectedCardIndex: 0,
    selectedElementId: null,
    activeTab: "card",
    themeScope: "all",
    snap: true,
    history: [],
    historyIndex: -1
  };

  const ui = {
    brandLink: document.querySelector("a.brand-mark"),
    brandIcon: document.getElementById("brandIcon"),
    saveStatus: document.getElementById("saveStatus"),
    undoBtn: document.getElementById("undoBtn"), redoBtn: document.getElementById("redoBtn"),
    cardCount: document.getElementById("cardCount"), cardList: document.getElementById("cardList"),
    addCardBtn: document.getElementById("addCardBtn"), cardUpBtn: document.getElementById("cardUpBtn"),
    cardDownBtn: document.getElementById("cardDownBtn"), duplicateCardBtn: document.getElementById("duplicateCardBtn"),
    deleteCardBtn: document.getElementById("deleteCardBtn"), editorPanel: document.getElementById("editorPanel"),
    deckTitle: document.getElementById("deckTitle"), deckMeta: document.getElementById("deckMeta"),
    layoutSelect: document.getElementById("layoutSelect"), themeSelect: document.getElementById("themeSelect"),
    themeAllBtn: document.getElementById("themeAllBtn"), themeCurrentBtn: document.getElementById("themeCurrentBtn"),
    snapToggle: document.getElementById("snapToggle"), overflowStatus: document.getElementById("overflowStatus"),
    sceneShell: document.getElementById("sceneShell"), cardScene: document.getElementById("cardScene"),
    exportJsonBtn: document.getElementById("exportJsonBtn"), importJsonBtn: document.getElementById("importJsonBtn"),
    exportPngBtn: document.getElementById("exportPngBtn"), exportAllBtn: document.getElementById("exportAllBtn"),
    deckFileInput: document.getElementById("deckFileInput"), elementImageInput: document.getElementById("elementImageInput")
  };

  function syncBrandIdentity() {
    const brandName = state.config.brandName || "前面-Aaron";
    const brandUrl = state.config.brandUrl || "https://nextwaylab.com/";
    if (ui.brandLink) {
      ui.brandLink.href = brandUrl;
      ui.brandLink.title = `访问${brandName}`;
      ui.brandLink.setAttribute("aria-label", `访问${brandName}网站`);
    }
    document.title = `${brandName} · 内容卡片编辑器`;
  }

  function currentCard() {
    return state.deck.cards[state.selectedCardIndex] || null;
  }

  function currentElement() {
    return currentCard()?.elements?.find((element) => element.id === state.selectedElementId) || null;
  }

  function contextFor(index) {
    const tailAsset = state.config.tailAsset === "qr" && state.assets.qr ? state.assets.qr : state.assets.brandIcon || state.assets.qr || "";
    return {
      index,
      total: state.deck.cards.length,
      source: state.deck.source || "",
      brandName: state.config.brandName || "前面-Aaron",
      assets: { ...state.assets, qr: tailAsset }
    };
  }

  function ensureMaterialized(forceIndex = -1) {
    state.deck.cards.forEach((card, index) => {
      Engine.materializeCard(card, contextFor(index), index === forceIndex);
    });
    refreshPageNumbers();
  }

  function refreshPageNumbers() {
    state.deck.cards.forEach((card, index) => {
      const page = card.elements?.find((element) => element.role === "page" && element.type === "text");
      if (page && /^\d{2}\s*\/\s*\d{2}$/.test(page.content?.text || "")) {
        page.content.text = `${String(index + 1).padStart(2, "0")} / ${String(state.deck.cards.length).padStart(2, "0")}`;
      }
    });
  }

  function storageKey() {
    return `content-card-editor::v2::${state.deck.id}`;
  }

  const STORAGE_DB = "content-card-editor";
  const STORAGE_STORE = "snapshots";
  const ASSET_REF_PREFIX = "asset-ref://";

  function assetReference(value) {
    if (typeof value !== "string" || !value.startsWith("data:")) return "";
    return Object.entries(state.assets).find(([, asset]) => asset && asset === value)?.[0] || "";
  }

  function snapshot({ portable = false } = {}) {
    const payload = { deck: state.deck, config: state.config, ...(portable ? { assets: state.assets } : {}) };
    return JSON.stringify(payload, (key, value) => {
      if (portable) return value;
      const assetName = assetReference(value);
      return assetName ? `${ASSET_REF_PREFIX}${assetName}` : value;
    });
  }

  function resolveAssetReferences(value) {
    if (typeof value === "string" && value.startsWith(ASSET_REF_PREFIX)) {
      return state.assets[value.slice(ASSET_REF_PREFIX.length)] || "";
    }
    if (Array.isArray(value)) return value.map(resolveAssetReferences);
    if (value && typeof value === "object") {
      Object.keys(value).forEach((key) => { value[key] = resolveAssetReferences(value[key]); });
    }
    return value;
  }

  function restoreSnapshot(value) {
    const parsed = JSON.parse(value);
    state.config = { ...state.config, ...(parsed.config || {}) };
    state.assets = { ...state.assets, ...(parsed.assets || {}) };
    state.deck = Engine.normalizeDeck(resolveAssetReferences(parsed.deck), "");
    state.selectedCardIndex = Math.min(state.selectedCardIndex, state.deck.cards.length - 1);
    state.selectedElementId = null;
    ensureMaterialized();
  }

  function openStorageDb() {
    return new Promise((resolve, reject) => {
      if (!window.indexedDB) {
        reject(new Error("IndexedDB 不可用"));
        return;
      }
      const request = indexedDB.open(STORAGE_DB, 1);
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains(STORAGE_STORE)) request.result.createObjectStore(STORAGE_STORE);
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error("无法打开浏览器存储"));
    });
  }

  async function writeStored(value) {
    const db = await openStorageDb();
    try {
      await new Promise((resolve, reject) => {
        const transaction = db.transaction(STORAGE_STORE, "readwrite");
        transaction.objectStore(STORAGE_STORE).put(value, storageKey());
        transaction.oncomplete = resolve;
        transaction.onerror = () => reject(transaction.error || new Error("保存失败"));
      });
    } finally {
      db.close();
    }
  }

  async function readStored() {
    const db = await openStorageDb();
    try {
      return await new Promise((resolve, reject) => {
        const request = db.transaction(STORAGE_STORE, "readonly").objectStore(STORAGE_STORE).get(storageKey());
        request.onsuccess = () => resolve(request.result || "");
        request.onerror = () => reject(request.error || new Error("读取失败"));
      });
    } finally {
      db.close();
    }
  }

  async function removeStored() {
    localStorage.removeItem(storageKey());
    const db = await openStorageDb();
    try {
      await new Promise((resolve, reject) => {
        const transaction = db.transaction(STORAGE_STORE, "readwrite");
        transaction.objectStore(STORAGE_STORE).delete(storageKey());
        transaction.oncomplete = resolve;
        transaction.onerror = () => reject(transaction.error || new Error("清除失败"));
      });
    } finally {
      db.close();
    }
  }

  function pushHistory() {
    const value = snapshot();
    if (state.history[state.historyIndex] === value) return;
    state.history = state.history.slice(0, state.historyIndex + 1);
    state.history.push(value);
    if (state.history.length > 35) state.history.shift();
    state.historyIndex = state.history.length - 1;
    updateHistoryButtons();
    scheduleSave();
  }

  let historyTimer = 0;
  function queueHistory() {
    clearTimeout(historyTimer);
    historyTimer = window.setTimeout(pushHistory, 450);
  }

  function updateHistoryButtons() {
    ui.undoBtn.disabled = state.historyIndex <= 0;
    ui.redoBtn.disabled = state.historyIndex >= state.history.length - 1;
  }

  function undo() {
    if (state.historyIndex <= 0) return;
    state.historyIndex -= 1;
    restoreSnapshot(state.history[state.historyIndex]);
    renderAll();
    updateHistoryButtons();
    scheduleSave();
  }

  function redo() {
    if (state.historyIndex >= state.history.length - 1) return;
    state.historyIndex += 1;
    restoreSnapshot(state.history[state.historyIndex]);
    renderAll();
    updateHistoryButtons();
    scheduleSave();
  }

  let saveTimer = 0;
  function scheduleSave() {
    ui.saveStatus.textContent = `${state.config.brandName || "前面-Aaron"} · 保存中`;
    clearTimeout(saveTimer);
    saveTimer = window.setTimeout(async () => {
      const value = snapshot();
      try {
        await writeStored(value);
        localStorage.removeItem(storageKey());
        ui.saveStatus.textContent = `${state.config.brandName || "前面-Aaron"} · 已保存`;
      } catch (error) {
        try {
          localStorage.setItem(storageKey(), value);
          ui.saveStatus.textContent = `${state.config.brandName || "前面-Aaron"} · 已保存`;
        } catch (fallbackError) {
          ui.saveStatus.textContent = "浏览器存储不可用，请下载 JSON";
        }
      }
    }, 260);
  }

  async function loadStored() {
    try {
      const raw = await readStored() || localStorage.getItem(storageKey());
      if (!raw) return false;
      restoreSnapshot(raw);
      if (localStorage.getItem(storageKey())) {
        await writeStored(raw).catch(() => undefined);
        localStorage.removeItem(storageKey());
      }
      return true;
    } catch (error) {
      try {
        const raw = localStorage.getItem(storageKey());
        if (!raw) return false;
        restoreSnapshot(raw);
        return true;
      } catch (fallbackError) {
        return false;
      }
    }
  }

  function elementLabel(element) {
    const content = element.content || {};
    const text = content.text || content.title || content.label || content.kind || element.role || element.type;
    return Engine.clean(text).slice(0, 22) || element.type;
  }

  function cardTitle(card) {
    const titleElement = card.elements?.find((element) => element.role === "title" && element.type === "text");
    return Engine.clean(titleElement?.content?.text || card.content?.title || layoutMap.get(card.layoutId)?.label || "未命名卡片");
  }

  function updateScale() {
    const scale = ui.sceneShell.clientWidth / 1080;
    ui.cardScene.style.transform = `scale(${scale})`;
  }

  function renderCardList() {
    ui.cardCount.textContent = `${state.deck.cards.length} 张`;
    ui.cardList.innerHTML = state.deck.cards.map((card, index) => `<button class="card-chip${index === state.selectedCardIndex ? " is-active" : ""}" type="button" data-card-index="${index}" title="${Engine.esc(cardTitle(card))}"><strong>${String(index + 1).padStart(2, "0")}</strong><span>${Engine.esc(cardTitle(card))}</span></button>`).join("");
    ui.cardUpBtn.disabled = state.selectedCardIndex === 0;
    ui.cardDownBtn.disabled = state.selectedCardIndex === state.deck.cards.length - 1;
    ui.deleteCardBtn.disabled = state.deck.cards.length <= 1;
  }

  function renderToolbar() {
    const card = currentCard();
    ui.deckTitle.textContent = state.deck.title || "内容卡片预览";
    ui.deckMeta.textContent = `1080 × 1440 · 第 ${state.selectedCardIndex + 1} / ${state.deck.cards.length} 张`;
    ui.layoutSelect.innerHTML = layouts.map((layout) => `<option value="${Engine.esc(layout.id)}">${Engine.esc(layout.label)} · ${Engine.esc(layout.kind)}</option>`).join("");
    ui.layoutSelect.value = card?.layoutId || "list.cards";
    ui.themeSelect.value = card?.themeId || "warm-editorial";
    ui.themeAllBtn.classList.toggle("is-active", state.themeScope === "all");
    ui.themeCurrentBtn.classList.toggle("is-active", state.themeScope === "current");
    ui.themeAllBtn.setAttribute("aria-pressed", String(state.themeScope === "all"));
    ui.themeCurrentBtn.setAttribute("aria-pressed", String(state.themeScope === "current"));
    ui.snapToggle.checked = state.snap;
  }

  function renderBrandIcon() {
    if (!ui.brandIcon) return;
    ui.brandIcon.src = state.assets.brandIcon || state.assets.qr || "";
  }

  function renderScene() {
    const card = currentCard();
    if (!card) {
      ui.cardScene.innerHTML = "";
      return;
    }
    const overflow = Engine.renderScene(ui.cardScene, card, state.selectedElementId);
    ui.overflowStatus.textContent = overflow ? `${overflow} 个文本区域可能溢出` : "";
    updateScale();
  }

  function layerRows(card) {
    const elements = [...(card.elements || [])].sort((a, b) => Number(b.zIndex || 0) - Number(a.zIndex || 0));
    return `<div class="layer-list">${elements.map((element) => `<div class="layer-row${element.id === state.selectedElementId ? " is-active" : ""}">
      <button class="icon-btn layer-icon" type="button" data-action="toggle-visible" data-element-id="${element.id}" title="${element.visible === false ? "显示" : "隐藏"}">${element.visible === false ? "○" : "●"}</button>
      <button class="layer-select" type="button" data-action="select-element" data-element-id="${element.id}">${Engine.esc(elementLabel(element))}<br><span class="layer-kind">${Engine.esc(element.type)} · ${Engine.esc(element.role || "无角色")}</span></button>
      <button class="icon-btn layer-icon" type="button" data-action="toggle-lock" data-element-id="${element.id}" title="${element.locked ? "解锁" : "锁定"}">${element.locked ? "■" : "□"}</button>
      <button class="icon-btn layer-icon danger" type="button" data-action="delete-element" data-element-id="${element.id}" title="删除元素">×</button>
    </div>`).join("")}</div>`;
  }

  function renderCardTab() {
    const card = currentCard();
    const layout = layoutMap.get(card.layoutId);
    return `<div class="panel-section">
      <h3 class="panel-title"><span>当前结构</span><span>${Engine.esc(layout?.label || card.layoutId)}</span></h3>
      <p class="help-text">切换布局会按内容字段重新排版；已删除的同名元素不会自动复活。</p>
      <div class="inline-actions" style="margin-top:10px">
        <button class="secondary-btn" type="button" data-action="reapply-layout">重新排版</button>
        <button class="secondary-btn" type="button" data-action="restore-roles">恢复默认元素</button>
      </div>
    </div>
    <div class="panel-section">
      <h3 class="panel-title">插入元素</h3>
      <div class="insert-grid">
        <button class="insert-btn" type="button" data-action="insert-text">文字</button>
        <button class="insert-btn" type="button" data-action="insert-panel">内容框</button>
        <button class="insert-btn" type="button" data-action="insert-image">图片 / SVG</button>
        <button class="insert-btn" type="button" data-action="insert-visual">信息图</button>
        <button class="insert-btn" type="button" data-action="insert-shape">形状</button>
      </div>
    </div>
    <div class="panel-section">
      <h3 class="panel-title">全部图层</h3>
      ${layerRows(card)}
    </div>`;
  }

  function textStyleFields(element) {
    const s = element.style || {};
    const color = /^#[0-9a-f]{6}$/i.test(s.color || "") ? s.color : "#17120f";
    return `<div class="form-grid">
      <label class="control">字号<input class="number-field" type="number" min="10" max="180" data-style-field="fontSize" value="${Number(s.fontSize || 36)}"></label>
      <label class="control">最小字号<input class="number-field" type="number" min="8" max="180" data-style-field="minFontSize" value="${Number(s.minFontSize || 16)}"></label>
      <label class="control">字重<input class="number-field" type="number" min="300" max="950" step="50" data-style-field="fontWeight" value="${Number(s.fontWeight || 700)}"></label>
      <label class="control">行高<input class="number-field" type="number" min="0.9" max="2.2" step="0.05" data-style-field="lineHeight" value="${Number(s.lineHeight || 1.35)}"></label>
      <label class="control">颜色<input class="field color-field" type="color" data-style-field="color" value="${color}"></label>
      <label class="control wide">对齐<select class="select" data-style-field="align"><option value="left"${s.align === "left" ? " selected" : ""}>左对齐</option><option value="center"${s.align === "center" ? " selected" : ""}>居中</option><option value="right"${s.align === "right" ? " selected" : ""}>右对齐</option></select></label>
    </div><p class="help-text">如果文字仍被自动缩小，可提高“最小字号”，并同步增大元素高度。</p>`;
  }

  function panelTypographyFields(element) {
    const s = element.style || {};
    return `<div class="form-grid">
      <label class="control">标签字号<input class="number-field" type="number" min="10" max="90" data-style-field="labelFontSize" value="${Number(s.labelFontSize || 30)}"></label>
      <label class="control">标题字号<input class="number-field" type="number" min="12" max="120" data-style-field="titleFontSize" value="${Number(s.titleFontSize || 38)}"></label>
      <label class="control">正文字号<input class="number-field" type="number" min="10" max="90" data-style-field="bodyFontSize" value="${Number(s.bodyFontSize || 28)}"></label>
      <label class="control">列表字号<input class="number-field" type="number" min="10" max="90" data-style-field="itemFontSize" value="${Number(s.itemFontSize || 30)}"></label>
    </div>`;
  }

  function visualTypographyFields(element) {
    const scale = Math.round(Number(element.style?.fontScale || 1.5) * 100);
    return `<div class="form-grid">
      <label class="control wide">图中文字比例
        <input class="range-field" type="range" min="60" max="180" step="5" data-font-scale value="${scale}">
      </label>
      <label class="control wide">比例（%）<input class="number-field" type="number" min="60" max="180" step="5" data-font-scale value="${scale}"></label>
    </div><p class="help-text">按比例调整信息图中的标题、说明与数字，不改变图形尺寸。</p>`;
  }

  function contentFields(element) {
    if (element.type === "text") {
      return `<label class="control">文字<textarea class="textarea" data-element-field="content.text">${Engine.esc(element.content?.text || "")}</textarea></label>`;
    }
    if (element.type === "panel") {
      const items = Engine.asItems(element.content?.items || [], 8).map((item) => [item.title, item.body, item.value].filter(Boolean).join("｜")).join("\n");
      return `<div class="form-grid">
        <label class="control wide">标签<input class="field" data-element-field="content.label" value="${Engine.esc(element.content?.label || "")}"></label>
        <label class="control wide">标题<input class="field" data-element-field="content.title" value="${Engine.esc(element.content?.title || "")}"></label>
        <label class="control wide">正文<textarea class="textarea" data-element-field="content.body">${Engine.esc(element.content?.body || "")}</textarea></label>
        <label class="control wide">列表<textarea class="textarea" data-list-field="content.items">${Engine.esc(items)}</textarea></label>
      </div>`;
    }
    if (element.type === "visual") {
      const items = Engine.asItems(element.content?.items || [], 16).map((item) => [item.title, item.body, item.value].filter(Boolean).join("｜")).join("\n");
      return `<div class="form-grid">
        <label class="control wide">图形<select class="select" data-element-field="content.kind">
          ${["timeline", "cycle", "axes", "matrix", "bento", "ranking", "dashboard", "concept"].map((kind) => `<option value="${kind}"${element.content?.kind === kind ? " selected" : ""}>${kind}</option>`).join("")}
        </select></label>
        <label class="control wide">结构数据<textarea class="textarea" data-list-field="content.items">${Engine.esc(items)}</textarea></label>
        <div class="wide"><button class="secondary-btn" type="button" data-action="replace-image" data-element-id="${element.id}">替换为图片 / SVG</button></div>
      </div>`;
    }
    if (element.type === "image") {
      return `<div class="form-grid">
        <label class="control wide">替代文字<input class="field" data-element-field="content.alt" value="${Engine.esc(element.content?.alt || "")}"></label>
        <label class="control wide">裁切<select class="select" data-style-field="fit"><option value="cover"${element.style?.fit === "cover" ? " selected" : ""}>填满</option><option value="contain"${element.style?.fit === "contain" ? " selected" : ""}>完整显示</option></select></label>
        <div class="wide inline-actions"><button class="secondary-btn" type="button" data-action="replace-image" data-element-id="${element.id}">替换素材</button><button class="secondary-btn danger" type="button" data-action="clear-image" data-element-id="${element.id}">移除素材</button></div>
      </div>`;
    }
    const fill = /^#[0-9a-f]{6}$/i.test(element.style?.fill || "") ? element.style.fill : "#f1ded0";
    return `<div class="form-grid"><label class="control">填充<input class="field color-field" type="color" data-style-field="fill" value="${fill}"></label><label class="control">圆角<input class="number-field" type="number" min="0" max="80" data-style-field="radius" value="${Number(element.style?.radius || 0)}"></label></div>`;
  }

  function renderElementTab() {
    const card = currentCard();
    const element = currentElement();
    if (!element) return `<div class="panel-section"><h3 class="panel-title">图层</h3>${layerRows(card)}</div><div class="empty-state">选择画布元素或左侧图层后编辑</div>`;
    const frame = element.frame || {};
    return `<div class="panel-section">
      <h3 class="panel-title"><span>${Engine.esc(elementLabel(element))}</span><span>${Engine.esc(element.type)}</span></h3>
      ${contentFields(element)}
    </div>
    <div class="panel-section">
      <h3 class="panel-title">位置与尺寸</h3>
      <div class="geometry-grid">
        ${[["x", "X"], ["y", "Y"], ["width", "宽度"], ["height", "高度"]].map(([key, label]) => `<label class="control">${label}<input class="number-field" type="number" data-frame-field="${key}" value="${Math.round(Number(frame[key] || 0))}"></label>`).join("")}
      </div>
      <div class="nudge-grid" style="margin-top:10px">
        <button class="icon-btn" type="button" data-action="nudge" data-dx="-8" data-dy="0" title="左移 8px">←</button>
        <button class="icon-btn" type="button" data-action="nudge" data-dx="0" data-dy="-8" title="上移 8px">↑</button>
        <button class="icon-btn" type="button" data-action="nudge" data-dx="0" data-dy="8" title="下移 8px">↓</button>
        <button class="icon-btn" type="button" data-action="nudge" data-dx="8" data-dy="0" title="右移 8px">→</button>
      </div>
      <div class="inline-actions" style="margin-top:8px;flex-wrap:wrap">
        <button class="secondary-btn" type="button" data-action="resize-step" data-dw="-8" data-dh="0">宽 −</button>
        <button class="secondary-btn" type="button" data-action="resize-step" data-dw="8" data-dh="0">宽 +</button>
        <button class="secondary-btn" type="button" data-action="resize-step" data-dw="0" data-dh="-8">高 −</button>
        <button class="secondary-btn" type="button" data-action="resize-step" data-dw="0" data-dh="8">高 +</button>
      </div>
    </div>
    ${element.type === "text" ? `<div class="panel-section"><h3 class="panel-title">文字大小与外观</h3>${textStyleFields(element)}</div>` : ""}
    ${element.type === "panel" ? `<div class="panel-section"><h3 class="panel-title">内容框文字大小</h3>${panelTypographyFields(element)}</div>` : ""}
    ${element.type === "visual" ? `<div class="panel-section"><h3 class="panel-title">信息图文字大小</h3>${visualTypographyFields(element)}</div>` : ""}
    <div class="panel-section">
      <h3 class="panel-title">图层操作</h3>
      <div class="inline-actions">
        <button class="secondary-btn" type="button" data-action="layer-up">上移一层</button>
        <button class="secondary-btn" type="button" data-action="layer-down">下移一层</button>
        <button class="secondary-btn" type="button" data-action="duplicate-element">复制</button>
        <button class="secondary-btn danger" type="button" data-action="delete-element" data-element-id="${element.id}">删除</button>
      </div>
    </div>
    <div class="panel-section"><h3 class="panel-title">全部图层</h3>${layerRows(card)}</div>`;
  }

  function renderPageTab() {
    return `<div class="panel-section">
      <h3 class="panel-title">页面信息</h3>
      <div class="form-grid">
        <label class="control wide">卡组标题<input class="field" data-deck-field="title" value="${Engine.esc(state.deck.title || "")}"></label>
        <label class="control wide">来源<input class="field" data-deck-field="source" value="${Engine.esc(state.deck.source || "")}"></label>
        <label class="control wide">默认品牌<input class="field" data-config-field="brandName" value="${Engine.esc(state.config.brandName || "")}"></label>
        <label class="control wide">导出尺寸<select class="select" data-config-field="exportScale"><option value="1"${Number(state.config.exportScale) === 1 ? " selected" : ""}>1080 × 1440</option><option value="2"${Number(state.config.exportScale) === 2 ? " selected" : ""}>2160 × 2880 高清版</option></select></label>
      </div>
    </div>
    <div class="panel-section">
      <h3 class="panel-title">便携数据</h3>
      <div class="inline-actions"><button class="secondary-btn" type="button" data-action="export-json">下载 JSON</button><button class="secondary-btn" type="button" data-action="import-json">导入 JSON</button></div>
      <p class="help-text">JSON 会包含已替换的图片与 SVG 数据，可在另一台电脑继续编辑。</p>
    </div>
    <div class="panel-section"><button class="secondary-btn danger" type="button" data-action="clear-storage">清除本地编辑记录</button></div>`;
  }

  function renderPublicationTab() {
    const publication = state.deck.publication || { titles: [], body: "" };
    const titleRows = publication.titles.map((title, index) => `<div class="publication-title-row">
      <input class="field" data-publication-title-index="${index}" value="${Engine.esc(title)}" aria-label="标题建议 ${index + 1}">
      <button class="icon-btn" type="button" data-action="copy-publication-title" data-title-index="${index}" title="复制标题" aria-label="复制标题 ${index + 1}">⧉</button>
      <button class="icon-btn danger" type="button" data-action="delete-publication-title" data-title-index="${index}" title="删除标题" aria-label="删除标题 ${index + 1}">×</button>
    </div>`).join("");
    return `<div class="panel-section publication-section">
      <h3 class="panel-title"><span>标题建议</span><span>${publication.titles.length} 个</span></h3>
      <div class="publication-title-list">${titleRows || '<p class="help-text">暂无标题建议</p>'}</div>
      <div class="inline-actions" style="margin-top:8px"><button class="secondary-btn" type="button" data-action="add-publication-title"${publication.titles.length >= 5 ? " disabled" : ""}>添加标题</button></div>
    </div>
    <div class="panel-section publication-section">
      <h3 class="panel-title">发布正文</h3>
      <p class="help-text">根据原文核心观点生成，可直接用于小红书或小绿书发布。</p>
      <label class="control"><textarea class="textarea publication-body" data-publication-field="body" aria-label="发布正文">${Engine.esc(publication.body || "")}</textarea></label>
      <div class="inline-actions" style="margin-top:8px"><button class="secondary-btn" type="button" data-action="copy-publication-body">复制正文</button></div>
    </div>`;
  }

  function renderEditor() {
    ui.editorPanel.innerHTML = state.activeTab === "element" ? renderElementTab()
      : state.activeTab === "page" ? renderPageTab()
      : state.activeTab === "publication" ? renderPublicationTab()
      : renderCardTab();
    document.querySelectorAll(".tab-btn").forEach((button) => button.classList.toggle("is-active", button.dataset.tab === state.activeTab));
  }

  function renderAll() {
    ensureMaterialized();
    renderBrandIcon();
    renderCardList();
    renderToolbar();
    renderScene();
    renderEditor();
  }

  function setNested(target, path, value) {
    const parts = path.split(".");
    let cursor = target;
    for (let i = 0; i < parts.length - 1; i += 1) {
      const key = /^\d+$/.test(parts[i]) ? Number(parts[i]) : parts[i];
      if (cursor[key] == null || typeof cursor[key] !== "object") cursor[key] = /^\d+$/.test(parts[i + 1]) ? [] : {};
      cursor = cursor[key];
    }
    const last = /^\d+$/.test(parts.at(-1)) ? Number(parts.at(-1)) : parts.at(-1);
    cursor[last] = value;
  }

  function syncBinding(element, field, value) {
    const card = currentCard();
    if (!card || !element.binding) return;
    if (element.type === "text" && field === "content.text") {
      setNested(card.content, element.binding, value);
      return;
    }
    if (element.type === "visual" && field === "content.items") {
      setNested(card.content, element.binding, value);
      return;
    }
    if (element.type === "panel") {
      const property = field.split(".").at(-1);
      if (element.binding === "quote" && property === "body") setNested(card.content, "quote", value);
      else if (element.binding === "quote" && property === "label") card.content.kicker = value;
      else if (element.binding === "quote" && property === "title") card.content.subtitle = value;
      else setNested(card.content, `${element.binding}.${property}`, value);
    }
  }

  function selectCard(index) {
    state.selectedCardIndex = Math.max(0, Math.min(Number(index), state.deck.cards.length - 1));
    state.selectedElementId = null;
    renderAll();
  }

  function selectElement(id) {
    state.selectedElementId = id;
    state.activeTab = "element";
    renderScene();
    renderEditor();
  }

  function applyLayout(forceRestore = false) {
    const card = currentCard();
    if (forceRestore) card.removedRoles = [];
    card.kind = layoutMap.get(card.layoutId)?.kind || card.kind;
    Engine.materializeCard(card, contextFor(state.selectedCardIndex), true);
    state.selectedElementId = null;
    renderAll();
    pushHistory();
  }

  function maxZ(card) {
    return Math.max(0, ...(card.elements || []).map((element) => Number(element.zIndex || 0)));
  }

  function insertElement(type) {
    const card = currentCard();
    const zIndex = maxZ(card) + 1;
    let element;
    if (type === "text") element = Engine.textElement("custom-text", { x: 96, y: 540, width: 520, height: 150, rotation: 0 }, "可编辑文字", { fontSize: 40, fontWeight: 850, zIndex });
    else if (type === "panel") element = Engine.panelElement("custom-panel", { x: 96, y: 520, width: 500, height: 360, rotation: 0 }, { label: "栏目", title: "内容框", body: "这里可以编辑、移动、缩放或删除。" }, { zIndex });
    else if (type === "visual") element = Engine.visualElement("custom-visual", { x: 96, y: 500, width: 888, height: 500, rotation: 0 }, "timeline", [{ title: "第一步" }, { title: "第二步" }, { title: "第三步" }], { zIndex }, "");
    else if (type === "shape") element = Engine.shapeElement("custom-shape", { x: 96, y: 540, width: 420, height: 240, rotation: 0 }, { fill: "#f1ded0", radius: 8, zIndex });
    else element = Engine.imageElement("custom-image", { x: 96, y: 500, width: 500, height: 500, rotation: 0 }, "", { zIndex });
    element.zIndex = zIndex;
    card.elements.push(element);
    state.selectedElementId = element.id;
    state.activeTab = "element";
    renderAll();
    pushHistory();
    if (type === "image") openImagePicker(element.id);
  }

  function deleteElement(id) {
    const card = currentCard();
    const index = card.elements.findIndex((element) => element.id === id);
    if (index < 0) return;
    const [removed] = card.elements.splice(index, 1);
    if (removed.role && !removed.role.startsWith("custom-")) {
      card.removedRoles = [...new Set([...(card.removedRoles || []), removed.role])];
    }
    if (state.selectedElementId === id) state.selectedElementId = null;
    renderAll();
    pushHistory();
  }

  function duplicateElement() {
    const card = currentCard();
    const element = currentElement();
    if (!element) return;
    const copy = Engine.clone(element);
    copy.id = Engine.uid(element.type);
    copy.role = `custom-${element.role || element.type}`;
    copy.binding = "";
    copy.frame.x += 24;
    copy.frame.y += 24;
    copy.zIndex = maxZ(card) + 1;
    card.elements.push(copy);
    state.selectedElementId = copy.id;
    renderAll();
    pushHistory();
  }

  function moveLayer(direction) {
    const card = currentCard();
    const element = currentElement();
    if (!element) return;
    element.zIndex = Math.max(1, Number(element.zIndex || 1) + direction);
    const sorted = [...card.elements].sort((a, b) => Number(a.zIndex || 0) - Number(b.zIndex || 0));
    sorted.forEach((item, index) => { item.zIndex = index + 1; });
    renderAll();
    pushHistory();
  }

  function openImagePicker(elementId) {
    ui.elementImageInput.dataset.targetElementId = elementId;
    ui.elementImageInput.value = "";
    ui.elementImageInput.click();
  }

  function replaceImageFile(file, elementId) {
    const card = currentCard();
    const element = card.elements.find((item) => item.id === elementId);
    if (!element || !file) return;
    const applyDataUrl = (dataUrl) => {
      element.type = "image";
      element.content = { src: String(dataUrl || ""), alt: file.name };
      element.style = { fit: "contain", radius: 8, ...(element.style || {}) };
      renderAll();
      pushHistory();
    };
    if (file.type === "image/svg+xml" || /\.svg$/i.test(file.name)) {
      const textReader = new FileReader();
      textReader.onload = () => {
        const source = String(textReader.result || "");
        const safe = source
          .replace(/<script\b[\s\S]*?<\/script>/gi, "")
          .replace(/<foreignObject\b[\s\S]*?<\/foreignObject>/gi, "")
          .replace(/\s+on[a-z]+\s*=\s*(["'])[\s\S]*?\1/gi, "")
          .replace(/\s+(?:href|xlink:href)\s*=\s*(["'])https?:[\s\S]*?\1/gi, "");
        const cleanReader = new FileReader();
        cleanReader.onload = () => applyDataUrl(cleanReader.result);
        cleanReader.readAsDataURL(new Blob([safe], { type: "image/svg+xml" }));
      };
      textReader.readAsText(file, "utf-8");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => applyDataUrl(reader.result);
    reader.readAsDataURL(file);
  }

  function mutateCards(action) {
    const index = state.selectedCardIndex;
    if (action === "add") {
      const card = {
        id: Engine.uid("card"), kind: "list", layoutId: "list.cards", themeId: currentCard()?.themeId || "warm-editorial",
        content: { title: "新卡片", items: [{ title: "要点", body: "编辑这里的内容" }] }, removedRoles: []
      };
      state.deck.cards.splice(index + 1, 0, card);
      state.selectedCardIndex = index + 1;
      Engine.materializeCard(card, contextFor(index + 1), true);
    } else if (action === "duplicate") {
      const copy = Engine.clone(currentCard());
      copy.id = Engine.uid("card");
      copy.elements.forEach((element) => { element.id = Engine.uid(element.type); });
      state.deck.cards.splice(index + 1, 0, copy);
      state.selectedCardIndex = index + 1;
    } else if (action === "delete" && state.deck.cards.length > 1) {
      state.deck.cards.splice(index, 1);
      state.selectedCardIndex = Math.min(index, state.deck.cards.length - 1);
    } else if (action === "up" && index > 0) {
      [state.deck.cards[index - 1], state.deck.cards[index]] = [state.deck.cards[index], state.deck.cards[index - 1]];
      state.selectedCardIndex -= 1;
    } else if (action === "down" && index < state.deck.cards.length - 1) {
      [state.deck.cards[index + 1], state.deck.cards[index]] = [state.deck.cards[index], state.deck.cards[index + 1]];
      state.selectedCardIndex += 1;
    }
    state.selectedElementId = null;
    ensureMaterialized();
    renderAll();
    pushHistory();
  }

  function downloadBlob(blob, name) {
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = name;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(link.href), 1500);
  }

  async function copyText(value) {
    const text = String(value || "");
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
    } catch (error) {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      textarea.remove();
    }
    ui.saveStatus.textContent = "已复制到剪贴板";
  }

  function safeFileName(value) {
    return Engine.clean(value).replace(/[\\/:*?"<>|]/g, "-").slice(0, 60) || "content-card";
  }

  function exportJson() {
    const payload = { ...state.deck, config: state.config, assets: state.assets };
    downloadBlob(new Blob([`${JSON.stringify(payload, null, 2)}\n`], { type: "application/json;charset=utf-8" }), `${safeFileName(state.deck.title)}-卡片数据.json`);
  }

  function importJsonFile(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result || "{}"));
        state.deck = Engine.normalizeDeck(parsed.deck || parsed, "");
        state.config = { ...state.config, ...(parsed.config || {}) };
        state.assets = { ...state.assets, ...(parsed.assets || {}) };
        state.selectedCardIndex = 0;
        state.selectedElementId = null;
        ensureMaterialized();
        state.history = [];
        state.historyIndex = -1;
        pushHistory();
        renderAll();
      } catch (error) {
        alert(`JSON 无法解析：${error.message}`);
      }
    };
    reader.readAsText(file, "utf-8");
  }

  function waitForImages(root) {
    return Promise.all([...root.querySelectorAll("img")].map((image) => {
      if (image.complete) return image.decode?.().catch(() => undefined);
      return new Promise((resolve) => {
        image.addEventListener("load", resolve, { once: true });
        image.addEventListener("error", resolve, { once: true });
      });
    }));
  }

  async function sceneToCanvas(scene, scale) {
    await document.fonts.ready;
    await waitForImages(scene);
    const clone = scene.cloneNode(true);
    clone.style.position = "relative";
    clone.style.left = "0";
    clone.style.top = "0";
    clone.style.transform = "none";
    clone.querySelectorAll(".is-selected").forEach((node) => node.classList.remove("is-selected", "is-locked"));
    clone.querySelectorAll(".resize-handle").forEach((node) => node.remove());
    const serialized = new XMLSerializer().serializeToString(clone);
    const css = document.querySelector("style").textContent.replaceAll("&", "&amp;").replaceAll("<", "&lt;");
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1440" viewBox="0 0 1080 1440"><foreignObject x="0" y="0" width="1080" height="1440"><div xmlns="http://www.w3.org/1999/xhtml"><style>${css}</style>${serialized}</div></foreignObject></svg>`;
    const image = new Image();
    image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
    await image.decode();
    const canvas = document.createElement("canvas");
    canvas.width = 1080 * scale;
    canvas.height = 1440 * scale;
    const context = canvas.getContext("2d");
    context.setTransform(scale, 0, 0, scale, 0, 0);
    context.drawImage(image, 0, 0, 1080, 1440);
    return canvas;
  }

  async function renderCardCanvas(index, scale) {
    const card = state.deck.cards[index];
    Engine.materializeCard(card, contextFor(index));
    const scene = document.createElement("div");
    scene.className = `card-scene theme-${card.themeId || "warm-editorial"}`;
    scene.style.position = "fixed";
    scene.style.left = "-5000px";
    scene.style.top = "0";
    scene.style.transform = "none";
    document.body.appendChild(scene);
    try {
      Engine.renderScene(scene, card, null);
      return await sceneToCanvas(scene, scale);
    } finally {
      scene.remove();
    }
  }

  function canvasBlob(canvas) {
    return new Promise((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("PNG 生成失败")), "image/png"));
  }

  // 无依赖 store 模式 ZIP:把多张 PNG 打成一个压缩包,一次性下载,规避浏览器对连续多文件下载的拦截。
  // 即使当前条目名只使用 ASCII，也明确写入 UTF-8 标志，避免 Windows 解压器误判后续中文文件名。
  const ZIP_UTF8_FLAG = 0x0800;
  const CRC_TABLE = (() => {
    const table = new Uint32Array(256);
    for (let n = 0; n < 256; n += 1) {
      let c = n;
      for (let k = 0; k < 8; k += 1) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
      table[n] = c >>> 0;
    }
    return table;
  })();

  function crc32(bytes) {
    let crc = 0xFFFFFFFF;
    for (let i = 0; i < bytes.length; i += 1) crc = CRC_TABLE[(crc ^ bytes[i]) & 0xFF] ^ (crc >>> 8);
    return (crc ^ 0xFFFFFFFF) >>> 0;
  }

  function buildZip(files) {
    const encoder = new TextEncoder();
    const chunks = [];
    const central = [];
    let offset = 0;
    const u16 = (v) => [v & 0xFF, (v >>> 8) & 0xFF];
    const u32 = (v) => [v & 0xFF, (v >>> 8) & 0xFF, (v >>> 16) & 0xFF, (v >>> 24) & 0xFF];
    for (const file of files) {
      const nameBytes = encoder.encode(file.name);
      const data = file.data;
      const crc = crc32(data);
      const local = [
        ...u32(0x04034b50), ...u16(20), ...u16(ZIP_UTF8_FLAG), ...u16(0), ...u16(0), ...u16(0),
        ...u32(crc), ...u32(data.length), ...u32(data.length),
        ...u16(nameBytes.length), ...u16(0)
      ];
      chunks.push(new Uint8Array(local), nameBytes, data);
      central.push({ nameBytes, crc, size: data.length, offset });
      offset += local.length + nameBytes.length + data.length;
    }
    const centralChunks = [];
    let centralSize = 0;
    for (const entry of central) {
      const header = [
        ...u32(0x02014b50), ...u16(20), ...u16(20), ...u16(ZIP_UTF8_FLAG), ...u16(0), ...u16(0), ...u16(0),
        ...u32(entry.crc), ...u32(entry.size), ...u32(entry.size),
        ...u16(entry.nameBytes.length), ...u16(0), ...u16(0), ...u16(0), ...u16(0), ...u32(0),
        ...u32(entry.offset)
      ];
      centralChunks.push(new Uint8Array(header), entry.nameBytes);
      centralSize += header.length + entry.nameBytes.length;
    }
    const end = new Uint8Array([
      ...u32(0x06054b50), ...u16(0), ...u16(0), ...u16(central.length), ...u16(central.length),
      ...u32(centralSize), ...u32(offset), ...u16(0)
    ]);
    return new Blob([...chunks, ...centralChunks, end], { type: "application/zip" });
  }

  function showBusy(text) {
    const overlay = document.createElement("div");
    overlay.className = "busy-overlay";
    overlay.textContent = text;
    document.body.appendChild(overlay);
    return overlay;
  }

  async function exportPng(index) {
    const overlay = showBusy("正在生成 PNG");
    try {
      const scale = Number(state.config.exportScale || 1);
      const canvas = await renderCardCanvas(index, scale);
      const blob = await canvasBlob(canvas);
      downloadBlob(blob, `${safeFileName(state.deck.title)}-${String(index + 1).padStart(2, "0")}.png`);
    } catch (error) {
      alert(`导出失败：${error.message}`);
    } finally {
      overlay.remove();
    }
  }

  async function exportAll() {
    const overlay = showBusy("正在生成全部 PNG");
    try {
      const scale = Number(state.config.exportScale || 1);
      const base = safeFileName(state.deck.title);
      const files = [];
      for (let index = 0; index < state.deck.cards.length; index += 1) {
        overlay.textContent = `正在生成 ${index + 1} / ${state.deck.cards.length}`;
        const canvas = await renderCardCanvas(index, scale);
        const blob = await canvasBlob(canvas);
        const bytes = new Uint8Array(await blob.arrayBuffer());
        // ZIP 内使用短 ASCII 文件名，兼容 Windows 资源管理器和常见解压软件。
        files.push({ name: `card-${String(index + 1).padStart(2, "0")}.png`, data: bytes });
      }
      if (files.length !== state.deck.cards.length || files.some((file) => file.data.length < 8)) {
        throw new Error("PNG 数量或文件内容不完整，已停止打包");
      }
      overlay.textContent = "正在打包 ZIP";
      const zipBlob = buildZip(files);
      downloadBlob(zipBlob, `${base}.zip`);
    } catch (error) {
      alert(`导出失败：${error.message}`);
    } finally {
      overlay.remove();
    }
  }

  function onEditorInput(event) {
    const target = event.target;
    const element = currentElement();
    if (target.dataset.publicationTitleIndex !== undefined) {
      state.deck.publication.titles[Number(target.dataset.publicationTitleIndex)] = target.value;
      queueHistory();
      return;
    }
    if (target.dataset.publicationField) {
      state.deck.publication[target.dataset.publicationField] = target.value;
      queueHistory();
      return;
    }
    if (target.dataset.deckField) {
      state.deck[target.dataset.deckField] = target.value;
      if (target.dataset.deckField === "source") {
        state.deck.cards.forEach((card) => card.elements?.filter((item) => item.role === "source" && item.type === "text").forEach((item) => { item.content.text = target.value ? `来源：${target.value}` : ""; }));
        renderScene();
      }
      renderCardList();
      renderToolbar();
      queueHistory();
      return;
    }
    if (target.dataset.configField) {
      const key = target.dataset.configField;
      state.config[key] = key === "exportScale" ? Number(target.value) : target.value;
      if (key === "brandName") {
        state.deck.cards.forEach((card) => card.elements?.filter((item) => item.role === "brand").forEach((item) => { item.content.text = target.value; }));
        syncBrandIdentity();
        renderScene();
      }
      queueHistory();
      return;
    }
    if (!element) return;
    if (target.dataset.elementField) {
      setNested(element, target.dataset.elementField, target.value);
      syncBinding(element, target.dataset.elementField, target.value);
    } else if (target.dataset.listField) {
      const value = Engine.asItems(target.value, 16);
      setNested(element, target.dataset.listField, value);
      syncBinding(element, target.dataset.listField, value);
    } else if (target.dataset.frameField) {
      element.frame[target.dataset.frameField] = Number(target.value || 0);
    } else if (target.dataset.styleField) {
      const numeric = ["fontSize", "minFontSize", "fontWeight", "lineHeight", "radius", "padding", "labelFontSize", "titleFontSize", "bodyFontSize", "itemFontSize"].includes(target.dataset.styleField);
      element.style[target.dataset.styleField] = numeric ? Number(target.value) : target.value;
    } else if (target.dataset.fontScale !== undefined) {
      const percent = Math.max(60, Math.min(180, Number(target.value || 100)));
      element.style.fontScale = percent / 100;
      ui.editorPanel.querySelectorAll("[data-font-scale]").forEach((control) => {
        if (control !== target) control.value = String(percent);
      });
    }
    renderScene();
    renderCardList();
    queueHistory();
  }

  function onEditorClick(event) {
    const button = event.target.closest("button[data-action]");
    if (!button) return;
    const action = button.dataset.action;
    const id = button.dataset.elementId || state.selectedElementId;
    if (action === "select-element") selectElement(id);
    else if (action === "toggle-visible" || action === "toggle-lock") {
      const element = currentCard().elements.find((item) => item.id === id);
      if (!element) return;
      if (action === "toggle-visible") element.visible = element.visible === false;
      else element.locked = !element.locked;
      renderAll();
      pushHistory();
    } else if (action === "delete-element") deleteElement(id);
    else if (action === "duplicate-element") duplicateElement();
    else if (action === "layer-up") moveLayer(1);
    else if (action === "layer-down") moveLayer(-1);
    else if (action === "nudge") {
      const element = currentElement();
      if (!element) return;
      element.frame.x += Number(button.dataset.dx || 0);
      element.frame.y += Number(button.dataset.dy || 0);
      renderAll();
      pushHistory();
    } else if (action === "resize-step") {
      const element = currentElement();
      if (!element) return;
      element.frame.width = Math.max(40, Number(element.frame.width || 40) + Number(button.dataset.dw || 0));
      element.frame.height = Math.max(40, Number(element.frame.height || 40) + Number(button.dataset.dh || 0));
      renderAll();
      pushHistory();
    } else if (action === "reapply-layout") applyLayout(false);
    else if (action === "restore-roles") applyLayout(true);
    else if (action.startsWith("insert-")) insertElement(action.replace("insert-", ""));
    else if (action === "replace-image") openImagePicker(id);
    else if (action === "clear-image") {
      const element = currentCard().elements.find((item) => item.id === id);
      if (element) element.content.src = "";
      renderAll();
      pushHistory();
    } else if (action === "export-json") exportJson();
    else if (action === "import-json") ui.deckFileInput.click();
    else if (action === "add-publication-title") {
      if (state.deck.publication.titles.length >= 5) return;
      state.deck.publication.titles.push("新的标题建议");
      renderEditor();
      pushHistory();
    } else if (action === "delete-publication-title") {
      state.deck.publication.titles.splice(Number(button.dataset.titleIndex), 1);
      renderEditor();
      pushHistory();
    } else if (action === "copy-publication-title") {
      copyText(state.deck.publication.titles[Number(button.dataset.titleIndex)]);
    } else if (action === "copy-publication-body") {
      copyText(state.deck.publication.body);
    }
    else if (action === "clear-storage") {
      removeStored()
        .then(() => { ui.saveStatus.textContent = "本地记录已清除"; })
        .catch(() => { ui.saveStatus.textContent = "本地记录清除失败"; });
    }
  }

  function onScenePointerDown(event) {
    const elementNode = event.target.closest("[data-element-id]");
    if (!elementNode) {
      state.selectedElementId = null;
      renderScene();
      renderEditor();
      return;
    }
    const id = elementNode.dataset.elementId;
    const element = currentCard().elements.find((item) => item.id === id);
    if (!element) return;
    state.selectedElementId = id;
    state.activeTab = "element";
    renderEditor();
    if (element.locked) {
      renderScene();
      return;
    }
    event.preventDefault();
    const resizeHandle = event.target.closest("[data-resize-handle]");
    const resizeMode = resizeHandle?.dataset.resizeHandle || "";
    const startX = event.clientX;
    const startY = event.clientY;
    const start = { ...element.frame };
    const scale = 1080 / ui.cardScene.getBoundingClientRect().width;
    const step = state.snap ? 8 : 1;
    const snapValue = (value) => Math.round(value / step) * step;

    function move(moveEvent) {
      const dx = (moveEvent.clientX - startX) * scale;
      const dy = (moveEvent.clientY - startY) * scale;
      if (resizeMode) {
        if (resizeMode === "width" || resizeMode === "both") element.frame.width = Math.max(40, snapValue(start.width + dx));
        if (resizeMode === "height" || resizeMode === "both") element.frame.height = Math.max(40, snapValue(start.height + dy));
      } else {
        element.frame.x = Math.max(-element.frame.width + 24, Math.min(1080 - 24, snapValue(start.x + dx)));
        element.frame.y = Math.max(-element.frame.height + 24, Math.min(1440 - 24, snapValue(start.y + dy)));
      }
      const node = ui.cardScene.querySelector(`[data-element-id="${CSS.escape(id)}"]`);
      if (node) {
        node.style.left = `${element.frame.x}px`;
        node.style.top = `${element.frame.y}px`;
        node.style.width = `${element.frame.width}px`;
        node.style.height = `${element.frame.height}px`;
      }
    }

    function up() {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      renderAll();
      pushHistory();
    }
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up, { once: true });
  }

  ui.cardList.addEventListener("click", (event) => {
    const button = event.target.closest("[data-card-index]");
    if (button) selectCard(button.dataset.cardIndex);
  });
  document.querySelectorAll(".tab-btn").forEach((button) => button.addEventListener("click", () => {
    state.activeTab = button.dataset.tab;
    renderEditor();
  }));
  ui.editorPanel.addEventListener("input", onEditorInput);
  ui.editorPanel.addEventListener("change", onEditorInput);
  ui.editorPanel.addEventListener("click", onEditorClick);
  ui.cardScene.addEventListener("pointerdown", onScenePointerDown);
  ui.undoBtn.addEventListener("click", undo);
  ui.redoBtn.addEventListener("click", redo);
  ui.addCardBtn.addEventListener("click", () => mutateCards("add"));
  ui.cardUpBtn.addEventListener("click", () => mutateCards("up"));
  ui.cardDownBtn.addEventListener("click", () => mutateCards("down"));
  ui.duplicateCardBtn.addEventListener("click", () => mutateCards("duplicate"));
  ui.deleteCardBtn.addEventListener("click", () => mutateCards("delete"));
  ui.layoutSelect.addEventListener("change", () => {
    currentCard().layoutId = ui.layoutSelect.value;
    applyLayout(false);
  });
  ui.themeSelect.addEventListener("change", () => {
    if (state.themeScope === "all") state.deck.cards.forEach((card) => { card.themeId = ui.themeSelect.value; });
    else currentCard().themeId = ui.themeSelect.value;
    renderAll();
    pushHistory();
  });
  ui.themeAllBtn.addEventListener("click", () => { state.themeScope = "all"; renderToolbar(); });
  ui.themeCurrentBtn.addEventListener("click", () => { state.themeScope = "current"; renderToolbar(); });
  ui.snapToggle.addEventListener("change", () => { state.snap = ui.snapToggle.checked; });
  ui.exportJsonBtn.addEventListener("click", exportJson);
  ui.importJsonBtn.addEventListener("click", () => ui.deckFileInput.click());
  ui.exportPngBtn.addEventListener("click", () => exportPng(state.selectedCardIndex));
  ui.exportAllBtn.addEventListener("click", exportAll);
  ui.deckFileInput.addEventListener("change", () => importJsonFile(ui.deckFileInput.files?.[0]));
  ui.elementImageInput.addEventListener("change", () => replaceImageFile(ui.elementImageInput.files?.[0], ui.elementImageInput.dataset.targetElementId));
  window.addEventListener("keydown", (event) => {
    const target = event.target;
    const editing = target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement;
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") {
      event.preventDefault();
      event.shiftKey ? redo() : undo();
    } else if (!editing && currentElement() && ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) {
      event.preventDefault();
      const amount = event.shiftKey ? 10 : 1;
      const element = currentElement();
      if (event.key === "ArrowLeft") element.frame.x -= amount;
      if (event.key === "ArrowRight") element.frame.x += amount;
      if (event.key === "ArrowUp") element.frame.y -= amount;
      if (event.key === "ArrowDown") element.frame.y += amount;
      renderAll();
      queueHistory();
    } else if (!editing && currentElement() && (event.key === "Delete" || event.key === "Backspace")) {
      event.preventDefault();
      deleteElement(state.selectedElementId);
    }
  });

  const observer = new ResizeObserver(updateScale);
  observer.observe(ui.sceneShell);

  ensureMaterialized();
  await loadStored();
  syncBrandIdentity();
  ensureMaterialized();
  pushHistory();
  renderAll();
})();
