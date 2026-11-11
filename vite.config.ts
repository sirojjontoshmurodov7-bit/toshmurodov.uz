import { defineConfig } from 'vite'

// Sof TypeScript + CSS: framework yo'q, shuning uchun plagin ham kerak emas.
export default defineConfig({
  build: {
    target: 'es2022',
    cssMinify: true,
    assetsInlineLimit: 2048,
  },
})
