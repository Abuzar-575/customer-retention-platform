import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { apiMiddleware } from '../simple-api/handler.mjs'

function retentionApiPlugin() {
  return {
    name: 'retention-api',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        apiMiddleware(req, res, next)
      })
      console.log('Score API mounted on this Vite server (/predict, /models, /insights)')
    },
  }
}

export default defineConfig({
  plugins: [react(), retentionApiPlugin()],
})
