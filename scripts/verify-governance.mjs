/* global console, process */

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, extname, join, resolve } from "node:path";

const files = [];
const walk = (directory) => {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const file = join(directory, entry.name);
    if (entry.isDirectory()) walk(file);
    else if (extname(file) === ".md") files.push(file);
  }
};

walk("docs");
walk(".opencode/agents");
files.push(".opencode/SESSION-NAMING.md");

const failures = [];
for (const file of files) {
  const content = readFileSync(file, "utf8");
  for (const match of content.matchAll(/\[[^\]]*\]\(([^)]+)\)/g)) {
    const target = match[1].split("#")[0];
    if (!target || /^(https?:|mailto:)/.test(target)) continue;
    const linked = resolve(dirname(file), decodeURIComponent(target));
    if (!existsSync(linked)) failures.push(`${file}: missing link ${target}`);
  }
}

const portable = (file) => file.replaceAll("\\", "/");

for (const file of files.filter((file) => portable(file).startsWith(".opencode/agents"))) {
  const content = readFileSync(file, "utf8");
  for (const forbidden of ["task: allow", '"node*": allow', '"gh api*": allow']) {
    if (content.includes(forbidden)) failures.push(`${file}: forbidden permission ${forbidden}`);
  }
  for (const gitWrite of [
    "git add",
    "git commit",
    "git push",
    "git fetch",
    "git merge",
    "git rebase",
    "git reset",
    "git restore",
    "git clean",
    "git checkout",
    "git switch",
    "git worktree add",
    "git worktree remove",
    "git branch -d",
    "git branch -D",
  ]) {
    const allowsWrite = content
      .split(/\r?\n/)
      .some((line) => line.trim().startsWith(`"${gitWrite}`) && line.trim().endsWith(": allow"));
    if (allowsWrite) {
      failures.push(`${file}: Git write permission must remain with ordinary Master: ${gitWrite}`);
    }
  }
}

for (const file of files.filter((file) => portable(file).startsWith("docs/04-plans") || portable(file).startsWith("docs/05-execs"))) {
  const content = readFileSync(file, "utf8");
  if (content.includes("对应短提示词")) failures.push(`${file}: references a per-target short prompt`);
}

const promptDirectory = "docs/08-prompts/development";
const allowedPrompts = new Set(["BROWSER.md", "EXEC.md", "MASTER.md", "PLAN.md", "REVIEW.md"]);
for (const entry of readdirSync(promptDirectory, { withFileTypes: true })) {
  if (!entry.isFile() || !allowedPrompts.has(entry.name)) {
    failures.push(`${promptDirectory}: unexpected per-target prompt asset ${entry.name}`);
  }
}
for (const prompt of allowedPrompts) {
  if (!existsSync(join(promptDirectory, prompt))) failures.push(`${promptDirectory}: missing role template ${prompt}`);
}

if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}

console.log(`Governance verification passed for ${files.length} Markdown files.`);
