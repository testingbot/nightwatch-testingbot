module.exports = {
  'opens localhost through the tunnel': function (browser) {
    browser.url('http://localhost:3999/').assert.textEquals('h1', 'Served from localhost')
  }
}
