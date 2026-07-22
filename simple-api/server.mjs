import http from 'node:http'
import { apiMiddleware, isApiPath } from './handler.mjs'

const PORT = 8000

const server = http.createServer((req, res) => {
  const url = new URL(req.url || '/', `http://localhost:${PORT}`)
  if (req.method === 'GET' && url.pathname === '/') {
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify({ status: 'Simple Retention API running' }))
    return
  }
  if (!isApiPath(url.pathname)) {
    res.statusCode = 404
    res.end(JSON.stringify({ detail: 'Not found' }))
    return
  }
  apiMiddleware(req, res, () => {
    res.statusCode = 404
    res.end(JSON.stringify({ detail: 'Not found' }))
  })
})

server.listen(PORT, '127.0.0.1', () => {
  console.log(`Simple Retention API on http://localhost:${PORT}`)
})
