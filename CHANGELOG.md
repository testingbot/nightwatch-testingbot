# Changelog

## 0.1.0 (unreleased)

- `withTestingBot()` adds `testingbot.*` environments and the plugin to a Nightwatch config; `testingbotEnvironment()` builds one environment.
- Credentials sent as HTTP basic auth, read from `TESTINGBOT_KEY` / `TESTINGBOT_SECRET`, `TB_KEY` / `TB_SECRET` or `~/.testingbot`.
- Plugin globals: TestingBot Tunnel in `before` / `after`, name and pass/fail status of every suite in `afterEach`.
