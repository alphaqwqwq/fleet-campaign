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
}

for (const file of files.filter((file) => portable(file).startsWith("docs/04-plans") || portable(file).startsWith("docs/05-execs"))) {
  const content = readFileSync(file, "utf8");
  if (content.includes("对应短提示词")) failures.push(`${file}: references a per-target short prompt`);
}

if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}

console.log(`Governance verification passed for ${files.length} Markdown files.`);
