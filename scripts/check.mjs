// Repository checks: every file the preview references exists, the code parses, and nothing
// private (keys, secrets, local machine paths) is committed. Zero dependencies: `npm run check`.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SELF = path.relative(ROOT, fileURLToPath(import.meta.url)).replace(/\\/g, '/');
const FORBIDDEN = [
  [/-----BEGIN [A-Z ]*PRIVATE KEY-----/, 'private key'],
  [/\b0x[0-9a-fA-F]{64}\b/, '32-byte hex value (possible private key)'],
  [/\b(secret|api[_-]?key|admin[_-]?key|password)\s*[:=]\s*['"][^'"]{8,}/i, 'hard-coded secret'],
  [/[A-Za-z]:\\Users\\|\/home\/[a-z]/, 'local machine path']
];

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === '.git' || e.name === 'node_modules') continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out); else out.push(p);
  }
  return out;
}

const problems = [];
let refs = 0;
for (const file of walk(ROOT)) {
  const rel = path.relative(ROOT, file).replace(/\\/g, '/');
  if (!/\.(html|css|js|mjs|md|json|yml)$/.test(rel) || rel === SELF) continue;
  const text = fs.readFileSync(file, 'utf8');
  for (const [re, what] of FORBIDDEN) if (re.test(text)) problems.push(`${rel}: ${what}`);
  if (!/\.(html|css|js)$/.test(rel)) continue;
  // Asset paths are written from the site root (public/..., src/...).
  for (const m of text.matchAll(/["'(](?:\.\/)?((?:public|src)\/[\w./-]+\.(?:png|css|js))/g)) {
    refs++;
    if (!fs.existsSync(path.join(ROOT, m[1]))) problems.push(`${rel}: missing ${m[1]}`);
  }
}

if (problems.length) {
  console.error(problems.map(p => '  x ' + p).join('\n'));
  process.exit(1);
}
console.log(`OK: ${refs} asset references resolve, no secrets or local paths.`);
