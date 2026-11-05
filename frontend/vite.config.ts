import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  // Vercel serves at the domain root. Set GITHUB_PAGES=true only for the
  // GitHub Pages project subpath deployment.
  base: process.env.GITHUB_PAGES === "true" ? "/mindmeld/" : "/",
  plugins: [react()],
})
