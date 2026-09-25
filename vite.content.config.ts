import { resolve } from 'node:path';

import { defineConfig } from 'vite';

// Content scripts não suportam ES modules, por isso são empacotados à parte como IIFE.
export default defineConfig({
  resolve: {
    alias: { '@': resolve(__dirname, 'src') },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: false,
    sourcemap: false,
    lib: {
      entry: resolve(__dirname, 'src/content/jira-issue.ts'),
      formats: ['iife'],
      name: 'TimesheetContent',
      fileName: () => 'content.js',
    },
  },
});
