import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vitest/config';

const rootDir = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
  },
  resolve: {
    alias: {
      '@': path.resolve(rootDir, './src'),
      '@/app': path.resolve(rootDir, './src/app'),
      '@/components': path.resolve(rootDir, './src/components'),
      '@/features': path.resolve(rootDir, './src/features'),
      '@/lib': path.resolve(rootDir, './src/lib'),
      '@/server': path.resolve(rootDir, './src/server'),
      '@/hooks': path.resolve(rootDir, './src/hooks'),
      '@/types': path.resolve(rootDir, './src/types'),
      '@/config': path.resolve(rootDir, './src/config'),
      '@/styles': path.resolve(rootDir, './src/styles'),
    },
  },
});
