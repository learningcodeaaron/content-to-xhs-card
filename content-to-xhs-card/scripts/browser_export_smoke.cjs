#!/usr/bin/env node
const assert = require("node:assert/strict");
const fs = require("node:fs");
const http = require("node:http");
const os = require("node:os");
const path = require("node:path");

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

function loadPackage(name) {
  try {
    return require(name);
  } catch (error) {
    // Continue with the bundled Codex runtime when the workspace has no local dependency.
  }
  const roots = [
    process.env.CODEX_NODE_MODULES,
    path.join(os.homedir(), ".cache", "codex-runtimes", "codex-primary-runtime", "dependencies", "node", "node_modules"),
  ].filter(Boolean);
  for (const root of roots) {
    const pnpmRoot = path.join(root, ".pnpm");
    if (!fs.existsSync(pnpmRoot)) continue;
    const entries = fs.readdirSync(pnpmRoot).filter((entry) => entry.startsWith(`${name}@`)).sort().reverse();
    for (const entry of entries) {
      const candidate = path.join(pnpmRoot, entry, "node_modules", name);
      try {
        return require(candidate);
      } catch (error) {
        // Try the next installed version.
      }
    }
  }
  throw new Error(`找不到 ${name}。请先安装 Playwright，或在 Codex Desktop 中运行此检查。`);
}

function edgeExecutable() {
  const candidates = process.platform === "win32" ? [
    path.join(process.env["PROGRAMFILES(X86)"] || "C:/Program Files (x86)", "Microsoft", "Edge", "Application", "msedge.exe"),
    path.join(process.env.PROGRAMFILES || "C:/Program Files", "Microsoft", "Edge", "Application", "msedge.exe"),
    path.join(process.env.LOCALAPPDATA || "", "Microsoft", "Edge", "Application", "msedge.exe"),
  ] : [];
  return candidates.find((candidate) => candidate && fs.existsSync(candidate)) || "";
}

function startServer(htmlPath) {
  const html = fs.readFileSync(htmlPath);
  const server = http.createServer((request, response) => {
    if (request.url === "/" || request.url.startsWith("/index.html")) {
      response.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" });
      response.end(html);
      return;
    }
    response.writeHead(404);
    response.end("Not found");
  });
  return new Promise((resolve) => server.listen(0, "127.0.0.1", () => resolve(server)));
}

function pngSize(filePath) {
  const buffer = fs.readFileSync(filePath);
  assert.equal(buffer.subarray(0, 8).toString("hex"), "89504e470d0a1a0a", "导出文件不是有效 PNG");
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20), bytes: buffer.length };
}

function storedZipPngEntries(filePath) {
  const buffer = fs.readFileSync(filePath);
  const entries = [];
  let offset = 0;
  while (offset + 30 <= buffer.length && buffer.readUInt32LE(offset) === 0x04034b50) {
    const flags = buffer.readUInt16LE(offset + 6);
    const method = buffer.readUInt16LE(offset + 8);
    const compressedSize = buffer.readUInt32LE(offset + 18);
    const nameLength = buffer.readUInt16LE(offset + 26);
    const extraLength = buffer.readUInt16LE(offset + 28);
    const nameStart = offset + 30;
    const dataStart = nameStart + nameLength + extraLength;
    const dataEnd = dataStart + compressedSize;
    assert(dataEnd <= buffer.length, "ZIP 条目长度越界");
    assert.equal(method, 0, "ZIP 回归仅支持当前无压缩 store 模式");
    assert(flags & 0x0800, "ZIP 条目没有声明 UTF-8 文件名");
    const name = buffer.subarray(nameStart, nameStart + nameLength).toString("utf8");
    const data = buffer.subarray(dataStart, dataEnd);
    entries.push({ name, data });
    offset = dataEnd;
  }
  assert(entries.length, "ZIP 中没有找到文件条目");
  assert(buffer.includes(Buffer.from([0x50, 0x4b, 0x05, 0x06])), "ZIP 缺少中央目录结束标记");
  return entries;
}

async function findCardWith(page, selector) {
  const cards = page.locator("[data-card-index]");
  for (let index = 0; index < await cards.count(); index += 1) {
    await cards.nth(index).evaluate((button) => button.click());
    if (await page.locator(`#cardScene ${selector}`).count()) return index;
  }
  return -1;
}

async function editorChecks(page, args = {}) {
  const brandLink = page.locator("a.brand-mark");
  assert.equal(await brandLink.getAttribute("href"), "https://nextwaylab.com/", "左上角品牌入口地址不正确");
  const brandSrc = await brandLink.locator("img").getAttribute("src");
  assert(brandSrc?.startsWith("data:image/"), "左上角没有内嵌品牌 IP 图");
  const brandBox = await brandLink.boundingBox();
  assert(brandBox && brandBox.width <= 36 && brandBox.height <= 36, `左上角品牌图尺寸异常：${brandBox?.width}×${brandBox?.height}`);

  assert(await page.locator("#themeAllBtn").getAttribute("class").then((value) => value.includes("is-active")), "默认配色范围不是整套");
  await page.locator("#themeSelect").selectOption("midnight-neon");
  assert((await page.locator("#cardScene").getAttribute("class")).includes("theme-midnight-neon"), "整套主题没有作用到当前卡");
  const cards = page.locator("[data-card-index]");
  await cards.nth(Math.min(1, (await cards.count()) - 1)).evaluate((button) => button.click());
  assert((await page.locator("#cardScene").getAttribute("class")).includes("theme-midnight-neon"), "整套主题没有作用到其他卡");
  await page.locator("#themeCurrentBtn").evaluate((button) => button.click());
  await page.locator("#themeSelect").selectOption("coral-paper");
  assert((await page.locator("#cardScene").getAttribute("class")).includes("theme-coral-paper"), "单卡主题没有作用到当前卡");
  await cards.first().evaluate((button) => button.click());
  assert((await page.locator("#cardScene").getAttribute("class")).includes("theme-midnight-neon"), "单卡主题错误地改动了其他卡");
  await page.locator("#themeAllBtn").evaluate((button) => button.click());
  await page.locator("#themeSelect").selectOption("warm-editorial");

  const publicationTab = page.locator('.tab-btn[data-tab="publication"]');
  assert.equal(await publicationTab.textContent(), "发布正文", "缺少独立的发布正文页签");
  await publicationTab.evaluate((button) => button.click());
  const publicationTitles = page.locator("[data-publication-title-index]");
  const originalTitleCount = await publicationTitles.count();
  const removedTitle = await publicationTitles.last().inputValue();
  assert(originalTitleCount >= 3 && originalTitleCount <= 5, "发布标题建议数量必须为 3～5 个");
  const publicationBody = page.locator('[data-publication-field="body"]');
  const publicationText = await publicationBody.inputValue();
  assert(publicationText.length >= 80, "发布正文为空或过短，无法独立概括原文");
  assert(!/这组卡片|顺着卡片|把卡片|卡片主要|本文将|一起来看看|建议收藏|家人们/.test(publicationText), "发布正文仍包含介绍卡片或平台套话");
  assert((publicationText.match(/\p{Extended_Pictographic}/gu) || []).length <= 1, "发布正文包含过多 emoji");
  await page.locator('[data-action="delete-publication-title"]').last().evaluate((button) => button.click());
  assert.equal(await publicationTitles.count(), originalTitleCount - 1, "发布标题删除失败");
  await page.locator('[data-action="add-publication-title"]').evaluate((button) => button.click());
  assert.equal(await publicationTitles.count(), originalTitleCount, "发布标题添加失败");
  await publicationTitles.last().fill(removedTitle);
  const publicationScreenshot = args["publication-ui-screenshot"] || args["page-ui-screenshot"];
  if (publicationScreenshot) {
    const screenshotPath = path.resolve(publicationScreenshot);
    fs.mkdirSync(path.dirname(screenshotPath), { recursive: true });
    await page.locator(".publication-section").last().evaluate((node) => node.scrollIntoView({ block: "start" }));
    await page.screenshot({ path: screenshotPath, fullPage: false });
  }

  const leadCard = await findCardWith(page, '[data-role="lead"]');
  if (leadCard >= 0) {
    await page.locator('#cardScene [data-role="lead"]').click();
    assert.equal(await page.locator('[data-style-field="fontSize"]').inputValue(), "30", "lead 默认字号不是 30");
  }

  const textCard = await findCardWith(page, ".canvas-element:has(.element-text)");
  assert(textCard >= 0, "卡组中没有可测试的文字元素");
  await page.locator("#cardScene .canvas-element:has(.element-text)").first().click();
  const fontInput = page.locator('[data-style-field="fontSize"]');
  const minFontInput = page.locator('[data-style-field="minFontSize"]');
  assert.equal(await fontInput.count(), 1, "普通文字缺少字号控件");
  assert.equal(await minFontInput.count(), 1, "普通文字缺少最小字号控件");
  const oldFont = Number(await fontInput.inputValue());
  await fontInput.fill(String(Math.min(180, oldFont + 4)));

  const panelCard = await findCardWith(page, ".canvas-element:has(.element-panel)");
  if (panelCard >= 0) {
    await page.locator("#cardScene .canvas-element:has(.element-panel)").first().click();
    const titleSize = page.locator('[data-style-field="titleFontSize"]');
    assert.equal(await titleSize.count(), 1, "内容框缺少标题字号控件");
    assert.equal(await page.locator('[data-style-field="labelFontSize"]').inputValue(), "30", "标签默认字号不是 30");
    assert.equal(await page.locator('[data-style-field="itemFontSize"]').inputValue(), "30", "列表默认字号不是 30");
    const oldSize = Number(await titleSize.inputValue());
    await titleSize.fill(String(Math.min(120, oldSize + 3)));
    const cssSize = await page.locator("#cardScene .canvas-element.is-selected .element-panel").evaluate((node) => node.style.getPropertyValue("--panel-title-size"));
    assert.equal(cssSize, `${Math.min(120, oldSize + 3)}px`, "内容框字号没有写入预览");
  }

  const visualCard = await findCardWith(page, ".canvas-element:has(.element-visual)");
  if (visualCard >= 0) {
    await page.locator("#cardScene .canvas-element:has(.element-visual)").first().click();
    const scaleInput = page.locator('input[type="number"][data-font-scale]');
    assert.equal(await scaleInput.count(), 1, "信息图缺少文字比例控件");
    assert.equal(await scaleInput.inputValue(), "150", "信息图默认文字比例不是 150%");
    const visualTextSelector = "#cardScene .element-visual [style*='font-size'], #cardScene .element-visual text[font-size]";
    const beforeSize = await page.locator(visualTextSelector).first().evaluate((node) => getComputedStyle(node).fontSize || node.getAttribute("font-size"));
    await scaleInput.fill("120");
    assert.equal(await scaleInput.inputValue(), "120", "信息图文字比例没有更新");
    const afterSize = await page.locator(visualTextSelector).first().evaluate((node) => getComputedStyle(node).fontSize || node.getAttribute("font-size"));
    assert.notEqual(afterSize, beforeSize, "信息图文字比例没有作用到预览");
  }

  const quoteCard = await findCardWith(page, ".panel-quote");
  if (quoteCard >= 0) {
    const quoteFits = await page.locator("#cardScene .panel-quote .element-panel").first().evaluate((node) => node.scrollHeight <= node.clientHeight + 2);
    assert(quoteFits, "panel-quote 仍有内容被截断");
  }

  await page.waitForTimeout(1300);
  const storage = await page.evaluate(async () => {
    const request = indexedDB.open("content-card-editor", 1);
    const db = await new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const keys = await new Promise((resolve, reject) => {
      const getKeys = db.transaction("snapshots", "readonly").objectStore("snapshots").getAllKeys();
      getKeys.onsuccess = () => resolve(getKeys.result);
      getKeys.onerror = () => reject(getKeys.error);
    });
    const value = keys.length ? await new Promise((resolve, reject) => {
      const getValue = db.transaction("snapshots", "readonly").objectStore("snapshots").get(keys[0]);
      getValue.onsuccess = () => resolve(String(getValue.result || ""));
      getValue.onerror = () => reject(getValue.error);
    }) : "";
    db.close();
    return { keys, storedLength: value.length, hasAssetRef: value.includes("asset-ref://"), localKeys: Object.keys(localStorage), status: document.getElementById("saveStatus")?.textContent || "" };
  });
  assert(storage.keys.length > 0, "编辑记录没有写入 IndexedDB");
  assert(storage.hasAssetRef, "自动保存快照没有对内置图片做资源引用去重");
  assert(storage.storedLength < 1000000, `自动保存快照仍然过大：${storage.storedLength} 字符`);
  assert(!storage.status.includes("不足") && !storage.status.includes("不可用"), `自动保存异常：${storage.status}`);
  assert(!storage.localKeys.some((key) => key.startsWith("content-card-editor::")), "大图卡组仍写入 localStorage");

  const lastIndex = (await cards.count()) - 1;
  await cards.nth(lastIndex).evaluate((button) => button.click());
  assert.equal(await page.locator(".card-chip.is-active strong").textContent(), String(lastIndex + 1).padStart(2, "0"), "尾页没有被选中");
  const tailImage = page.locator('#cardScene [data-role="qr"] img');
  assert.equal(await tailImage.count(), 1, "默认尾页缺少品牌 IP 图");
  assert.equal(await tailImage.getAttribute("src"), brandSrc, "默认尾页没有使用品牌 IP 图");
}

const args = parseArgs(process.argv.slice(2));
if (!args.input) {
  console.log("用法：node scripts/browser_export_smoke.cjs --input path/to/index.html [--output path/to/export.png]");
  process.exit(1);
}

const inputPath = path.resolve(args.input);
if (!fs.existsSync(inputPath)) {
  console.error(`[错误] 找不到 HTML：${inputPath}`);
  process.exit(1);
}
const outputPath = path.resolve(args.output || path.join(path.dirname(inputPath), "browser-export-smoke.png"));
fs.mkdirSync(path.dirname(outputPath), { recursive: true });

let browser;
let server;
(async () => {
  const { chromium } = loadPackage("playwright");
  server = await startServer(inputPath);
  const port = server.address().port;
  const executablePath = edgeExecutable();
  browser = await chromium.launch({
    headless: true,
    ...(executablePath ? { executablePath } : {}),
    args: ["--disable-gpu"],
  });
  const context = await browser.newContext({
    viewport: { width: Number(args["viewport-width"] || 1440), height: Number(args["viewport-height"] || 900) },
    acceptDownloads: true
  });
  const page = await context.newPage();
  const dialogs = [];
  const pageErrors = [];
  page.on("dialog", async (dialog) => {
    dialogs.push(dialog.message());
    await dialog.dismiss();
  });
  page.on("pageerror", (error) => pageErrors.push(error.message));

  await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: "networkidle" });
  await page.locator("#cardScene").waitFor({ state: "visible" });
  if (args["ui-screenshot-before"]) {
    const screenshotPath = path.resolve(args["ui-screenshot-before"]);
    fs.mkdirSync(path.dirname(screenshotPath), { recursive: true });
    await page.screenshot({ path: screenshotPath, fullPage: false });
  }
  await editorChecks(page, args);
  if (args["ui-screenshot"]) {
    const screenshotPath = path.resolve(args["ui-screenshot"]);
    fs.mkdirSync(path.dirname(screenshotPath), { recursive: true });
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: screenshotPath, fullPage: false });
  }
  const downloadPromise = page.waitForEvent("download", { timeout: 30000 }).catch(() => null);
  await page.getByRole("button", { name: "导出当前 PNG", exact: true }).click();
  const download = await downloadPromise;
  assert(download, `未触发 PNG 下载。页面提示：${dialogs.join(" | ") || "无"}`);
  await download.saveAs(outputPath);

  const size = pngSize(outputPath);
  assert.equal(size.width, 1080, "默认 PNG 宽度必须为 1080");
  assert.equal(size.height, 1440, "默认 PNG 高度必须为 1440");
  assert(size.bytes > 10000, "PNG 文件过小，可能是空白画布");
  assert.equal(dialogs.length, 0, `导出出现页面错误：${dialogs.join(" | ")}`);
  assert.equal(pageErrors.length, 0, `页面脚本错误：${pageErrors.join(" | ")}`);

  if (args["zip-output"]) {
    const zipOutputPath = path.resolve(args["zip-output"]);
    fs.mkdirSync(path.dirname(zipOutputPath), { recursive: true });
    const cardCount = await page.locator("[data-card-index]").count();
    const zipDownloadPromise = page.waitForEvent("download", { timeout: 180000 }).catch(() => null);
    await page.locator("#exportAllBtn").click();
    const zipDownload = await zipDownloadPromise;
    assert(zipDownload, `未触发 ZIP 下载。页面提示：${dialogs.join(" | ") || "无"}`);
    await zipDownload.saveAs(zipOutputPath);
    const entries = storedZipPngEntries(zipOutputPath);
    assert.equal(entries.length, cardCount, "ZIP 内 PNG 数量与卡片数量不一致");
    entries.forEach((entry, index) => {
      assert.equal(entry.name, `card-${String(index + 1).padStart(2, "0")}.png`, "ZIP 内图片命名不兼容");
      assert.equal(entry.data.subarray(0, 8).toString("hex"), "89504e470d0a1a0a", `${entry.name} 不是有效 PNG`);
      assert.equal(entry.data.readUInt32BE(16), 1080, `${entry.name} 宽度不正确`);
      assert.equal(entry.data.readUInt32BE(20), 1440, `${entry.name} 高度不正确`);
    });
    console.log(`[检查] ZIP 内含 ${entries.length} 张有效 PNG，文件名与 UTF-8 标志兼容 Windows 解压。`);
  }

  console.log(`[通过] 浏览器编辑与真实导出成功：${outputPath}`);
  console.log(`[检查] 默认字号、quote 完整性、整套/单卡主题、发布文案、品牌入口、IndexedDB 与尾页品牌图均正常；PNG ${size.width}×${size.height}，${size.bytes} bytes；无 Canvas 污染、弹窗或页面脚本错误。`);
  await browser.close();
  server.close();
})().catch((error) => {
  console.error(`[错误] ${error.stack || error.message}`);
  if (browser) browser.close().catch(() => undefined);
  if (server) server.close();
  process.exitCode = 1;
});
