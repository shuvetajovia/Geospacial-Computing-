import { readFileSync } from 'node:fs'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  // Vercel serves at the domain root. Set GITHUB_PAGES=true only for the
  // GitHub Pages project subpath deployment.
  base: process.env.GITHUB_PAGES === "true" ? "/mindmeld/" : "/",
  define: { __PACKAGED_POINT_SNAPSHOT__: readFileSync(new URL('./public/point-snapshot.json', import.meta.url), 'utf8') },
  plugins: [react()],
})
