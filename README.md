# @testingbot/nightwatch

[Nightwatch](https://nightwatchjs.org) plugin for [TestingBot](https://testingbot.com):

- `withTestingBot(config, options)` adds ready-made `testingbot.*` environments for the browsers you list (Chrome, Edge, Firefox, Safari on Windows, macOS and Linux).
- After every test suite, its name and pass/fail status (with the failed test cases) are sent to TestingBot.
- `tunnel: true` starts a [TestingBot Tunnel](https://testingbot.com/support/tunnel) in the global `before` hook and stops it in `after`, so the remote browsers can open `localhost` and other internal sites.

Requires Node.js 20 or later and Nightwatch 2.6 or later (tested with 3.16).

## Install

```sh
npm install --save-dev @testingbot/nightwatch
```

## Credentials

Your TestingBot key and secret are read from, in this order:

1. `TESTINGBOT_KEY` and `TESTINGBOT_SECRET`
2. `TB_KEY` and `TB_SECRET`
3. the file `~/.testingbot`, containing `key:secret` on one line

You find them in the [TestingBot member area](https://testingbot.com/members/user/edit). They are sent to the hub as HTTP basic auth (`webdriver.username` / `webdriver.access_key`), not as capabilities, so they do not show up in Nightwatch's logs and HTML report.

## Configure

```js
// nightwatch.conf.js
const { withTestingBot } = require('@testingbot/nightwatch')

module.exports = withTestingBot(
  {
    src_folders: ['tests'],
    test_settings: {
      default: { launch_url: 'https://testingbot.com' }
    }
  },
  {
    browsers: {
      chrome: { browserName: 'chrome', browserVersion: 'latest', platformName: 'WIN11' },
      firefox: { browserName: 'firefox', platformName: 'LINUX' },
      safari: { browserName: 'safari', platformName: 'SEQUOIA' }
    },
    build: process.env.GITHUB_RUN_ID && `GitHub run ${process.env.GITHUB_RUN_ID}`
  }
)
```

This adds the plugin to `plugins` and the environments `testingbot.chrome`, `testingbot.firefox` and `testingbot.safari` (and `testingbot`, the first browser):

```sh
npx nightwatch --env testingbot.chrome
npx nightwatch --env testingbot.chrome,testingbot.firefox,testingbot.safari   # in parallel
```

Your tests stay the same. At the end of each suite the plugin prints the TestingBot link:

```
[@testingbot/nightwatch] passed login https://testingbot.com/members/tests/91115642...
```

### Options

| Option | Default | |
| --- | --- | --- |
| `browsers` | `{ chrome: { browserName: 'chrome' } }` | Environment name to [W3C capabilities](https://testingbot.com/support/web-automate/selenium/capabilities): `browserName`, `browserVersion` (default `latest`), `platformName`, and `'tb:options'` for this browser. |
| `build` | `TESTINGBOT_BUILD` or generated | Groups the run in the dashboard, or `false`. |
| `name` | the test module name | Fixed name for every session. |
| `tunnel` | off | `true`, or [testingbot-tunnel-launcher options](https://github.com/testingbot/testingbot-tunnel-launcher#options). See below. |
| `tbOptions` | | `tb:options` for every browser, for example `{ screenrecorder: true, seleniumVersion: '4.24.0' }`. |
| `reportStatus` | `true` | Send name and status after every suite. |
| `printLinks` | `true` | Print the session link after every suite. |
| `environmentPrefix` | `testingbot` | Prefix of the environment names. |
| `hub` | `hub.testingbot.com:443`, `/wd/hub`, SSL | `{ host, port, ssl, pathPrefix }`. |

Settings you give for a generated environment in `test_settings` (for example `'testingbot.chrome': { globals: {...} }`) are kept and win over the generated ones (shallow merge).

### Your own environments

Use `testingbotEnvironment()` to write the environments yourself, and add the plugin:

```js
const { testingbotEnvironment } = require('@testingbot/nightwatch')

module.exports = {
  src_folders: ['tests'],
  plugins: ['@testingbot/nightwatch'],
  test_settings: {
    'testingbot.edge': testingbotEnvironment({ browserName: 'MicrosoftEdge', platformName: 'WIN11' }, { build: 'nightly' })
  }
}
```

The plugin reports status for every environment that points at `*.testingbot.com` or has `tb:options`.

## Test status

Nightwatch runs one WebDriver session per test suite (file), so one TestingBot session is one suite. After a suite (in the global `afterEach` hook) the plugin calls the [TestingBot REST API](https://testingbot.com/support/api) with:

- **name**: the test module, for example `login` or `checkout/payment` (or the `name` option);
- **success**: passed when no test case in the suite failed or errored;
- **status message**: `3 test cases passed`, or the failed test cases with their first error line.

The session id is taken when the suite starts, so this works also when your test calls `browser.end()`. The REST call uses [testingbot-api](https://www.npmjs.com/package/testingbot-api); if it fails, the plugin logs a warning and the run continues.

## TestingBot Tunnel

```js
module.exports = withTestingBot({
  src_folders: ['tests'],
  test_settings: { default: { launch_url: 'http://localhost:3000' } }
}, {
  browsers: { chrome: { browserName: 'chrome' } },
  tunnel: true
})
```

The tunnel is started once in the main Nightwatch process (also when environments or workers run in parallel) with [testingbot-tunnel-launcher](https://github.com/testingbot/testingbot-tunnel-launcher), and every session is sent with its `tunnel-identifier`. The identifier is generated per run, so parallel CI jobs on the same account each use their own tunnel. Configure it with launcher options:

```js
tunnel: { tunnelIdentifier: 'checkout', verbose: true, tunnelVersion: '5.0' }
```

Use a tunnel that is already running (for example started by the [TestingBot Tunnel GitHub Action](https://github.com/testingbot/testingbot-tunnel-action)):

```js
tunnel: { tunnelIdentifier: process.env.TB_TUNNEL_ID, start: false }
```

The tunnel needs Java (17 for tunnel 5.0, 11 for older versions).

## Limitations

- Status is per suite (file), as that is what one TestingBot session covers. To get one session per test case, put each test case in its own file.
- `withTestingBot` writes the credentials into `webdriver.username` / `webdriver.access_key` of the generated environments when the config is loaded, so credentials must be available then.

## Development

```sh
npm install
npm test
npm run typecheck
npm run build
```

## License

MIT
