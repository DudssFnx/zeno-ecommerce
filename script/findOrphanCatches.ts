import fs from "fs";
const file = "server/routes.ts";
const data = fs.readFileSync(file, "utf8");
const lines = data.split(/\r?\n/);
for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  if (/^\s*catch\s*\(/.test(line)) {
    console.log("--- catch at line", i + 1);
    const start = Math.max(0, i - 3);
    for (let j = start; j <= Math.min(lines.length - 1, i + 2); j++) {
      console.log((j + 1).toString().padStart(5), lines[j]);
    }
  }
}
console.log("done");
