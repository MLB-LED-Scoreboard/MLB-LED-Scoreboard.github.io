import { defineConfig } from 'vite';
import { nodePolyfills } from 'vite-plugin-node-polyfills';

export default defineConfig({
  base: '/',
  build: {
    outDir: 'dist'
  },
  plugins: [
    nodePolyfills()
  ]
});
