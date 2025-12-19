import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'

// https://vite.dev/config/
export default defineConfig({
  base: '/hotwheels-ocr-webgl.js/',   // 👈 REQUIRED for GitHub Pages
  plugins: [svelte()],
})
