import { getCredentials, type CredentialOptions } from './credentials'
import { generateTunnelIdentifier, type TunnelOptions } from './tunnel'

export const PLUGIN_NAME = '@testingbot/nightwatch'
export const BUILD_ENV = 'TESTINGBOT_NIGHTWATCH_BUILD'
export const TUNNEL_IDENTIFIER_ENV = 'TESTINGBOT_NIGHTWATCH_TUNNEL_IDENTIFIER'

/** W3C capabilities for one browser, see https://testingbot.com/support/web-automate/selenium/capabilities */
export interface BrowserCapabilities {
  /** `chrome`, `firefox`, `MicrosoftEdge`, `safari`, ... */
  browserName: string
  /** A version, `latest` or `latest-N`. */
  browserVersion?: string
  /** For example `WIN11`, `SEQUOIA`, `LINUX`. */
  platformName?: string
  /** Extra TestingBot options for this browser (merged with the shared `tbOptions`). */
  'tb:options'?: Record<string, unknown>
  [capability: string]: unknown
}

export interface HubOptions {
  host?: string
  port?: number
  ssl?: boolean
  pathPrefix?: string
}

/** Options read by the plugin's global hooks at run time. Stored in the Nightwatch settings under `@testingbot/nightwatch`. */
export interface PluginSettings {
  /** Send the pass/fail status and name of each test suite to TestingBot after it ran. Default `true`. */
  reportStatus?: boolean
  /** Fixed session name. Default: the name of the test module (file). */
  name?: string
  /** Tunnel to start in the global `before` hook and stop in `after`, or `false`. */
  tunnel?: (TunnelOptions & { tunnelIdentifier: string }) | false
  /** Print a link to each TestingBot session. Default `true`. */
  printLinks?: boolean
}

export interface TestingBotOptions extends CredentialOptions {
  /**
   * Browsers, by environment name. `{ chrome: {...}, firefox: {...} }` creates the environments
   * `testingbot.chrome` and `testingbot.firefox`; the first one is also available as `testingbot`.
   * Default: the latest Chrome.
   */
  browsers?: Record<string, BrowserCapabilities>
  /** Build name that groups this run. Defaults to `TESTINGBOT_BUILD`, else a generated `nightwatch <date>`. `false` sends none. */
  build?: string | false
  /** Fixed session name for every suite. Default: the test module name. */
  name?: string
  /**
   * Start a TestingBot Tunnel before the run and stop it afterwards. `true` uses a generated identifier.
   * Pass `testingbot-tunnel-launcher` options to configure it, or `{ tunnelIdentifier, start: false }`
   * to use a tunnel that is already running.
   */
  tunnel?: boolean | (TunnelOptions & { start?: boolean })
  /** Extra `tb:options` for every browser, for example `{ screenrecorder: true, seleniumVersion: '4.24.0' }`. */
  tbOptions?: Record<string, unknown>
  /** Send each suite's status and name to TestingBot. Default `true`. */
  reportStatus?: boolean
  /** Print a link to each TestingBot session. Default `true`. */
  printLinks?: boolean
  /** Prefix of the generated environment names. Default `testingbot`. */
  environmentPrefix?: string
  /** Defaults to `hub.testingbot.com:443`, `/wd/hub`, SSL. */
  hub?: HubOptions
}

// Loose Nightwatch config types, so this package works with any Nightwatch typings version.
export interface NightwatchConfig {
  plugins?: string[]
  test_settings?: Record<string, Record<string, unknown>>
  [key: string]: unknown
}

function stable(env: NodeJS.ProcessEnv, name: string, generate: () => string): string {
  const existing = env[name]
  if (existing) return existing
  const value = generate()
  env[name] = value
  return value
}

function compact<T extends Record<string, unknown>>(object: T): T {
  for (const key of Object.keys(object)) if (object[key] === undefined) delete object[key]
  return object
}

/** Resolves the build name and tunnel for a run. Values that are generated are stored in the environment, so worker processes use the same ones. */
export function resolveRun(options: TestingBotOptions = {}): { build?: string; tunnelIdentifier?: string; tunnel: PluginSettings['tunnel'] } {
  const env = options.env ?? process.env
  const build =
    options.build === false
      ? undefined
      : (options.build ?? env.TESTINGBOT_BUILD ?? stable(env, BUILD_ENV, () => `nightwatch ${new Date().toISOString().replace('T', ' ').slice(0, 19)}`))
  let tunnelIdentifier: string | undefined
  let tunnel: PluginSettings['tunnel'] = false
  if (options.tunnel) {
    const { start = true, ...tunnelOptions } = options.tunnel === true ? {} : options.tunnel
    tunnelIdentifier = (tunnelOptions.tunnelIdentifier as string | undefined) ?? stable(env, TUNNEL_IDENTIFIER_ENV, () => generateTunnelIdentifier())
    if (start) tunnel = { ...tunnelOptions, tunnelIdentifier }
  }
  return { build, tunnelIdentifier, tunnel }
}

/**
 * Builds a Nightwatch environment (`webdriver` + `desiredCapabilities`) that runs on the TestingBot grid.
 *
 * ```js
 * test_settings: {
 *   'testingbot.safari': testingbotEnvironment({ browserName: 'safari', platformName: 'SEQUOIA' }, { build: 'nightly' })
 * }
 * ```
 */
export function testingbotEnvironment(capabilities: BrowserCapabilities, options: TestingBotOptions & { tunnelIdentifier?: string } = {}): Record<string, unknown> {
  const { key, secret } = getCredentials(options)
  const hub = options.hub ?? {}
  const { 'tb:options': browserTbOptions, ...caps } = capabilities
  const tbOptions = compact({
    ...(options.tbOptions ?? {}),
    ...(browserTbOptions ?? {}),
    build: options.build === false ? undefined : ((browserTbOptions?.build as string | undefined) ?? options.build ?? (options.tbOptions?.build as string | undefined)),
    name: (browserTbOptions?.name as string | undefined) ?? options.name ?? (options.tbOptions?.name as string | undefined),
    'tunnel-identifier': options.tunnelIdentifier
  } as Record<string, unknown>)
  return {
    selenium: { start_process: false },
    webdriver: {
      start_process: false,
      host: hub.host ?? 'hub.testingbot.com',
      port: hub.port ?? 443,
      ssl: hub.ssl ?? true,
      default_path_prefix: hub.pathPrefix ?? '/wd/hub',
      keep_alive: true,
      // Sent as HTTP basic auth, so the secret does not end up in the capabilities,
      // which Nightwatch writes to its logs and reports.
      username: key,
      access_key: secret,
      timeout_options: { timeout: 120000, retry_attempts: 3 }
    },
    desiredCapabilities: { browserVersion: 'latest', ...caps, 'tb:options': tbOptions }
  }
}

/**
 * Adds TestingBot environments and the plugin to a Nightwatch config.
 *
 * ```js
 * // nightwatch.conf.js
 * const { withTestingBot } = require('@testingbot/nightwatch')
 *
 * module.exports = withTestingBot({ src_folders: ['tests'] }, {
 *   browsers: {
 *     chrome: { browserName: 'chrome', platformName: 'WIN11' },
 *     firefox: { browserName: 'firefox', platformName: 'LINUX' }
 *   },
 *   tunnel: true
 * })
 * ```
 *
 * Then run `npx nightwatch --env testingbot.chrome,testingbot.firefox`.
 */
export function withTestingBot<T extends NightwatchConfig>(config: T, options: TestingBotOptions = {}): T {
  const prefix = options.environmentPrefix ?? 'testingbot'
  const { build, tunnelIdentifier, tunnel } = resolveRun(options)
  const browsers = options.browsers && Object.keys(options.browsers).length > 0 ? options.browsers : { chrome: { browserName: 'chrome' } }

  const pluginSettings: PluginSettings = compact({
    reportStatus: options.reportStatus ?? true,
    printLinks: options.printLinks ?? true,
    name: options.name,
    tunnel
  })

  const testSettings: Record<string, Record<string, unknown>> = { ...(config.test_settings ?? {}) }
  const environments = Object.entries(browsers).map(([name, caps]) => {
    const environment = testingbotEnvironment(caps, { ...options, build: build ?? false, tunnelIdentifier })
    return [`${prefix}.${name}`, { ...environment, [PLUGIN_NAME]: pluginSettings }] as const
  })
  // `testingbot` is the first browser; user settings for an environment win over the generated ones.
  testSettings[prefix] = { ...environments[0][1], ...(testSettings[prefix] ?? {}) }
  for (const [name, environment] of environments) testSettings[name] = { ...environment, ...(testSettings[name] ?? {}) }

  const plugins = [...(config.plugins ?? [])]
  if (!plugins.includes(PLUGIN_NAME)) plugins.push(PLUGIN_NAME)

  return { ...config, plugins, test_settings: testSettings, [PLUGIN_NAME]: pluginSettings }
}
