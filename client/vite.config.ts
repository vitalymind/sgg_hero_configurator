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
  }
});