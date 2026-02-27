import { defineConfig } from 'vite'
import path from 'path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  // 깃허브 레포지토리 이름이 'Chart-Manager'인 경우입니다.
  // URL 주소창에 보이는 이름과 정확히 일치해야 합니다.
  base: '/ChartManager/', 
  plugins: [
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  assetsInclude: ['**/*.svg', '**/*.csv'],
})