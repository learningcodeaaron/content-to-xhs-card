#!/usr/bin/env node
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { chromium } from "playwright";

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) continue;
    const next = argv[index + 1];
    args[token.slice(2)] = next && !next.startsWith("--") ? next : true;
    if (next && !next.startsWith("--")) index += 1;
  }
  return args;
}

const args = parseArgs(process.argv.slice(2));
const input = path.resolve(String(args.input || "examples/ai-agent-moat/index.html"));
const output = path.resolve(String(args.output || "examples/ai-agent-moat/demo.webm"));
if (!fs.existsSync(input)) throw new Error(`Demo HTML not found: ${input}`);

const videoDir = path.join(path.dirname(output), ".video-tmp");
fs.mkdirSync(videoDir, { recursive: true });

const html = fs.readFileSync(input);
const server = http.createServer((request, response) => {
  if (request.url === "/index.html" || request.url === "/") {
    response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    response.end(html);
    return;
  }
  response.writeHead(404);
  response.end("Not found");
});

await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const address = server.address();
if (!address || typeof address === "string") throw new Error("Unable to start demo server");

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1280, height: 720 },
  recordVideo: { dir: videoDir, size: { width: 1280, height: 720 } },
});
const page = await context.newPage();
const video = page.video();
if (!video) throw new Error("Playwright video recording did not start");

async function caption(message) {
  await page.evaluate((text) => {
    let node = document.getElementById("demo-caption");
    if (!node) {
      node = document.createElement("div");
      node.id = "demo-caption";
      Object.assign(node.style, {
        position: "fixed",
        left: "50%",
        bottom: "22px",
        transform: "translateX(-50%)",
        zIndex: "99999",
        maxWidth: "850px",
        padding: "12px 22px",
        borderRadius: "999px",
        background: "rgba(32, 38, 51, 0.92)",
        color: "white",
        font: "600 18px/1.5 system-ui, sans-serif",
        textAlign: "center",
        boxShadow: "0 12px 30px rgba(0, 0, 0, 0.2)",
      });
      document.body.appendChild(node);
    }
    node.textContent = text;
  }, message);
}

try {
  await page.goto(`http://127.0.0.1:${address.port}/index.html`, { waitUntil: "networkidle" });
  await caption("真实卡组 · 所有文字和元素都可以继续编辑");
  await page.waitForTimeout(1800);

  await caption("切换卡片，检查整套叙事与不同布局");
  for (const index of [1, 4, 7, 9]) {
    await page.locator(`[data-card-index="${index}"]`).click();
    await page.waitForTimeout(900);
  }

  await page.locator('[data-card-index="4"]').click();
  await caption("主题既可以作用于整套，也可以只调整当前卡片");
  await page.locator("#themeSelect").selectOption("rose-ink");
  await page.waitForTimeout(1500);

  await caption("标题建议和发布正文也在同一个发布包里");
  await page.locator('[data-tab="publication"]').click();
  await page.waitForTimeout(1800);

  await caption("完成后导出单张 PNG，或一次导出整套 ZIP");
  await page.waitForTimeout(1800);
} finally {
  await Promise.all([video.saveAs(output), context.close()]);
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}

fs.rmSync(videoDir, { recursive: true, force: true });
console.log(`已生成无配音演示视频：${output}`);
