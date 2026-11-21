module.exports = {
  'opens a public site': function (browser) {
    browser.url('https://example.com/').assert.titleContains('Example Domain')
  }
}
