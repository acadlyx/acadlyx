import fs from "node:fs";
import path from "node:path";

const root = path.resolve(process.cwd(), "src");
const extensions = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"]);
const suspicious = /\\n(?=\s*(?:import\b|export\b|const\b|let\b|var\b|return\b|if\b|for\b|while\b|\}|\)|<))/;

function walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (entry.name === "node_modules" || entry.name === ".next") continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...walk(full));
    else if (extensions.has(path.extname(entry.name))) files.push(full);
  }
  return files;
}

const failures = [];
for (const file of walk(root)) {
  const text = fs.readFileSync(file, "utf8");
  const lines = text.split("\n");
  lines.forEach((line, index) => {
    if (suspicious.test(line)) failures.push(`${path.relative(process.cwd(), file)}:${index + 1}: suspicious literal \\n escape`);
  });
  if (/^<<<<<<< |^=======$|^>>>>>>> /m.test(text)) {
    failures.push(`${path.relative(process.cwd(), file)}: unresolved merge conflict marker`);
  }
}

if (failures.length) {
  console.error("Source validation failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
console.log(`Source validation passed: scanned ${walk(root).length} frontend source files.`);
