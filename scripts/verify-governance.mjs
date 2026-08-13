/* global console, process */

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, extname, join, resolve } from "node:path";

const walk = (directory, out) => {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const file = join(directory, entry.name);
    if (entry.isDirectory()) walk(file, out);
    else if (extname(file) === ".md") out.push(file);
  }
};

const all = [];
walk("docs", all);
// docs/archive is reference-only; links there are not actively maintained.
const portable = (file) => file.replaceAll("\\", "/");
const files = all.filter((file) => !portable(file).startsWith("docs/archive/"));

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

if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}

console.log(`Docs link verification passed for ${files.length} Markdown files.`);
