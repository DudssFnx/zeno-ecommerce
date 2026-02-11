import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

function walk(dir: string) {
  const files: string[] = [];
  for (const f of fs.readdirSync(dir)) {
    const full = path.join(dir, f);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) {
      files.push(...walk(full));
    } else if (full.endsWith('.ts')) {
      files.push(full);
    }
  }
  return files;
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const serverDir = path.join(__dirname, '..');
const files = walk(serverDir);
let changed = 0;
for (const file of files) {
  let content = fs.readFileSync(file, 'utf8');
  const orig = content;
  // replace typed catch bindings
  content = content.replace(/catch \(error:\s*any\)/g, 'catch (error)');

  // replace simple patterns of res.status(500).json({ message: (error as any).message || String(error) })
  content = content.replace(/res\.status\(500\)\.json\(\{\s*message:\s*error\.message\s*\}\)/g, 'res.status(500).json({ message: (error as any).message || String(error) })');

  if (content !== orig) {
    fs.writeFileSync(file, content, 'utf8');
    console.log('Patched', file);
    changed++;
  }
}
console.log('Done. Files changed:', changed);
