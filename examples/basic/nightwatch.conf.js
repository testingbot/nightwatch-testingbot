const { withTestingBot } = require('@testingbot/nightwatch')

module.exports = withTestingBot(
  {
    src_folders: ['tests'],
    output_folder: 'reports',
    globals_path: 'globals.js'
  },
  {
    browsers: {
      chrome: { browserName: 'chrome', platformName: 'LINUX' },
      firefox: { browserName: 'firefox', platformName: 'WIN11' }
    },
    tunnel: true
  }
)
