// Compiles every contract in contracts/ with the official Solidity compiler (solc-js).
// Fails on any compiler error; prints warnings. `npm run contracts`
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import solc from 'solc';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIR = path.join(ROOT, 'contracts');

export function compileAll() {
  const sources = {};
  for (const f of fs.readdirSync(DIR).filter(f => f.endsWith('.sol'))) {
    sources[f] = { content: fs.readFileSync(path.join(DIR, f), 'utf8') };
  }
  const input = {
    language: 'Solidity',
    sources,
    settings: {
      optimizer: { enabled: true, runs: 200 },
      evmVersion: 'cancun',
      outputSelection: { '*': { '*': ['abi', 'evm.bytecode.object', 'evm.deployedBytecode.object'] } }
    }
  };
  const out = JSON.parse(solc.compile(JSON.stringify(input)));
  const errors = (out.errors || []).filter(e => e.severity === 'error');
  const warnings = (out.errors || []).filter(e => e.severity !== 'error');
  return { out, errors, warnings, files: Object.keys(sources) };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { out, errors, warnings, files } = compileAll();
  for (const w of warnings) console.warn(w.formattedMessage.trim());
  if (errors.length) {
    for (const e of errors) console.error(e.formattedMessage.trim());
    process.exit(1);
  }
  for (const f of files) {
    for (const [name, c] of Object.entries(out.contracts[f] || {})) {
      if (!c.evm.bytecode.object) continue;
      console.log(`OK ${f} → ${name}: ${c.evm.deployedBytecode.object.length / 2} bytes`);
    }
  }
  console.log(`solc ${solc.version()}`);
}
