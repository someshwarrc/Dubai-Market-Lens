import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { sites } from '@openai/sites-vite-plugin';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const staticSitesWorker = () => ({
  name: 'static-sites-worker',
  apply: 'build',
  async closeBundle() {
    const serverDirectory = resolve('dist', 'server');
    await mkdir(serverDirectory, { recursive: true });
    await writeFile(
      resolve(serverDirectory, 'index.js'),
      `export default {
  async fetch(request, env) {
    return env.ASSETS.fetch(request);
  },
};
`,
      'utf8',
    );
  },
});

export default defineConfig({
  plugins: [react(), sites(), staticSitesWorker()],
  publicDir: 'files',
  build: {
    sourcemap: true,
  },
});
