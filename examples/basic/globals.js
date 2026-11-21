// Serves a page that only exists on this machine; the remote browser reaches it through TestingBot Tunnel.
const http = require('node:http')
let server

module.exports = {
  before(done) {
    server = http
      .createServer((req, res) => {
        res.setHeader('content-type', 'text/html')
        res.end('<!doctype html><title>Local page</title><h1>Served from localhost</h1>')
      })
      .listen(3999, done)
  },
  after(done) {
    server.close(() => done())
  }
}
