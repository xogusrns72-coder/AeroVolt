import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { viteSingleFile } from 'vite-plugin-singlefile'

// 공유용 단일 HTML 파일 빌드 (Claude Artifact 게시용).
// 일반 dev/build(vite.config.js)와는 별도 설정이라 GitHub Pages 배포 등에는 영향 없음.
export default defineConfig({
  plugins: [react(), viteSingleFile()],
  build: {
    outDir: 'dist-artifact',
    emptyOutDir: true,
  },
})
