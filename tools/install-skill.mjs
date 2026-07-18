#!/usr/bin/env node
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..");
const source = path.join(repoRoot, "content-to-xhs-card");

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

function usage() {
  return [
    "Usage:",
    "  node tools/install-skill.mjs --target codex [--force]",
    "  node tools/install-skill.mjs --target claude [--force]",
    "  node tools/install-skill.mjs --destination /absolute/path [--force]",
  ].join("\n");
}

function copyDirectory(sourceDir, destinationDir) {
  fs.mkdirSync(destinationDir, { recursive: true });
  for (const entry of fs.readdirSync(sourceDir, { withFileTypes: true })) {
    const from = path.join(sourceDir, entry.name);
    const to = path.join(destinationDir, entry.name);
    if (entry.isDirectory()) copyDirectory(from, to);
    else if (entry.isFile()) fs.copyFileSync(from, to);
    else throw new Error(`Unsupported entry in Skill directory: ${from}`);
  }
}

const args = parseArgs(process.argv.slice(2));
if (args.help || args.h) {
  console.log(usage());
  process.exit(0);
}

const targetRoots = {
  codex: path.join(os.homedir(), ".codex", "skills"),
  claude: path.join(os.homedir(), ".claude", "skills"),
};

if (!fs.existsSync(path.join(source, "SKILL.md"))) {
  console.error(`[error] Skill source is incomplete: ${source}`);
  process.exit(1);
}

let destination = "";
if (args.destination) {
  destination = path.resolve(String(args.destination));
} else if (typeof args.target === "string" && targetRoots[args.target]) {
  destination = path.join(targetRoots[args.target], "content-to-xhs-card");
} else {
  console.error("[error] Choose --target codex, --target claude, or an explicit --destination.");
  console.error(usage());
  process.exit(1);
}

if (fs.existsSync(destination) && !args.force) {
  console.error(`[error] Destination already exists: ${destination}`);
  console.error("Run again with --force to replace it after reviewing your local changes.");
  process.exit(1);
}

try {
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  if (fs.existsSync(destination)) fs.rmSync(destination, { recursive: true, force: true });
  copyDirectory(source, destination);
} catch (error) {
  console.error(`[error] Unable to install Skill: ${error.message}`);
  process.exit(1);
}

console.log(`[done] Installed content-to-xhs-card at ${destination}`);
console.log("Restart the AI client before using the Skill.");
