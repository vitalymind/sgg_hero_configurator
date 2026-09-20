/// <reference types="vitest/config" />

import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
      '@hero_manager/shared': path.resolve(import.meta.dirname, '../packages/shared/src'),
    },
  },
  server: {
    host: '0.0.0.0',
    port: 3010,
    open: true,
    headers: {
      'Cross-Origin-Embedder-Policy': 'require-corp',
      'Cross-Origin-Opener-Policy': 'same-origin',
    },
		proxy: {
			'/api': {
				target: 'http://localhost:3000',
				changeOrigin: true,
			}
		}
  },
	test: {
		environment: 'happy-dom',
		setupFiles: ['./tests/setup.ts'],
		include: ['tests/**/*.test.ts'],
	}
});