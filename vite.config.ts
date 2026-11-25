import { createHash } from 'node:crypto';
import { existsSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

const base = process.env.VITE_BASE ?? '/KnowledgeKeeper/';

/** Stamps the handwritten worker with its build-specific files and version. */
function stampServiceWorker(): Plugin {
  let outDir = '';
  let bundleFiles: string[] = [];
  return {
    name: 'kk-stamp-service-worker',
    apply: 'build',
    configResolved(config) {
      outDir = resolve(config.root, config.build.outDir);
    },
    generateBundle(_options, bundle) {
      bundleFiles = Object.keys(bundle)
        .filter((file) => file !== 'sw.js' && !file.endsWith('.map'))
        .map((file) => `./${file}`);
    },
    closeBundle() {
      const workerPath = resolve(outDir, 'sw.js');
      if (!existsSync(workerPath)) return;
      const template = readFileSync(workerPath, 'utf8');
      const precache = [...new Set([
        './',
        './index.html',
        './manifest.webmanifest',
        './icons/icon.svg',
        './icons/icon-192.png',
        './icons/icon-512.png',
        './icons/apple-touch-icon.png',
        ...bundleFiles,
      ])];
      const hash = createHash('sha256').update(template);
      for (const entry of precache) {
        const name = entry === './' ? 'index.html' : entry.slice(2);
        hash.update(name);
        const path = resolve(outDir, name);
        if (existsSync(path) && statSync(path).isFile()) {
          hash.update(readFileSync(path));
        }
      }
      const version = hash.digest('hex').slice(0, 12);
      const devBuild = "const BUILD = { version: 'dev', precache: [] };";
      if (!template.includes(devBuild)) {
        throw new Error('Service worker build stamp not found in dist/sw.js');
      }
      writeFileSync(
        workerPath,
        template.replace(
          devBuild,
          `const BUILD = { version: '${version}', precache: ${JSON.stringify(precache)} };`,
        ),
      );
    },
  };
}

export default defineConfig({
  base,
  plugins: [react(), stampServiceWorker()],
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
