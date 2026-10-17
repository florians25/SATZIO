// Macht das iOS-Projekt eigenständig: Capacitor-Plugins werden aus node_modules
// nach ios/App/CapApp-SPM/Plugins kopiert und Package.swift darauf umgestellt.
// Dadurch öffnet sich das Xcode-Projekt ohne vorheriges `pnpm install` auf dem Mac
// (sonst: "Missing package product CapApp-SPM").
// Aufruf: nach `npx cap sync ios` → `node scripts/vendor-ios.mjs`
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const spmDir = resolve(here, '../ios/App/CapApp-SPM');
const pkgFile = join(spmDir, 'Package.swift');
let pkg = readFileSync(pkgFile, 'utf8');

const re = /\.package\(name: "([^"]+)", path: "([^"]+)"\)/g;
const plugins = [...pkg.matchAll(re)];
if (!plugins.length) {
  console.log('Keine lokalen Plugin-Pfade gefunden – Package.swift ist bereits eigenständig.');
  process.exit(0);
}
const pluginsDir = join(spmDir, 'Plugins');
rmSync(pluginsDir, { recursive: true, force: true });
mkdirSync(pluginsDir, { recursive: true });

for (const [full, name, relPath] of plugins) {
  const src = resolve(spmDir, relPath);
  if (!existsSync(join(src, 'Package.swift'))) {
    console.error(`Plugin ${name} nicht gefunden unter ${src} – zuerst "pnpm install" und "npx cap sync ios" ausführen.`);
    process.exit(1);
  }
  const dest = join(pluginsDir, name);
  mkdirSync(dest, { recursive: true });
  cpSync(join(src, 'ios', 'Sources'), join(dest, 'ios', 'Sources'), { recursive: true });
  for (const f of ['LICENSE', 'README.md']) if (existsSync(join(src, f))) cpSync(join(src, f), join(dest, f));
  // Testziele entfernen (Testordner werden nicht mitkopiert)
  let manifest = readFileSync(join(src, 'Package.swift'), 'utf8');
  manifest = manifest.replace(/,\s*\.testTarget\([\s\S]*?\)\s*(?=\]\s*\)\s*$)/m, '\n    ');
  writeFileSync(join(dest, 'Package.swift'), manifest);
  pkg = pkg.replace(full, `.package(name: "${name}", path: "Plugins/${name}")`);
  console.log(`✓ ${name} → Plugins/${name}`);
}
writeFileSync(pkgFile, pkg);
console.log('✓ Package.swift auf eigenständige Plugin-Kopien umgestellt.');
