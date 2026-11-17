import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { fileURLToPath } from 'node:url'

const localApiModule = new URL('./api/index.js', import.meta.url).href

function localVercelApi() {
  return {
    name: 'local-vercel-api',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith('/api')) return next()
        try {
          const chunks = []
          let length = 0
          for await (const chunk of req) {
            length += chunk.length
            if (length > 4_500_000) throw Object.assign(new Error('This request is too large.'), { status: 413 })
            chunks.push(chunk)
          }
          const origin = `http://${req.headers.host || 'localhost:5173'}`
          const request = new Request(new URL(req.url, origin), {
            method: req.method,
            headers: req.headers,
            body: chunks.length ? Buffer.concat(chunks) : undefined,
          })
          const api = await import(localApiModule)
          const response = await api.default.fetch(request)
          res.statusCode = response.status
          for (const [name, value] of response.headers) {
            if (name !== 'set-cookie') res.setHeader(name, value)
          }
          const cookies = response.headers.getSetCookie?.() || []
          if (cookies.length) res.setHeader('set-cookie', cookies)
          res.end(Buffer.from(await response.arrayBuffer()))
        } catch (error) {
          console.error(error)
          res.statusCode = Number.isInteger(error?.status) ? error.status : 500
          res.setHeader('content-type', 'application/json; charset=utf-8')
          res.end(JSON.stringify({ error: error?.message || 'Local API request failed.' }))
        }
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  // Keep the source alias independent of the hosting provider's dev tooling.
  base: '/',
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  plugins: [
    react(),
    localVercelApi(),
  ],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    // Vite builds the browser bundle; Vercel packages api/index.js separately.
    sourcemap: false,
    manifest: true,
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            { name: 'three', test: /[\\/]node_modules[\\/]three[\\/]/, priority: 20 },
            { name: 'animation', test: /[\\/]node_modules[\\/]animejs[\\/]/, priority: 10 },
          ],
        },
      },
    },
  },
});
