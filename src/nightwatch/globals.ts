/**
 * Global hooks of the @testingbot/nightwatch plugin. Nightwatch loads this file for every
 * package listed in `plugins` that has a `nightwatch/globals.js` next to its main file.
 *
 * - `before` / `after` (main process): start and stop TestingBot Tunnel.
 * - `beforeEach` (each test suite, after its session started): remember the session id.
 * - `afterEach` (each test suite): send the suite's name and pass/fail status to TestingBot.
 */
import { PLUGIN_NAME, type PluginSettings } from '../settings'
import { reportSession, suiteOutcome, testUrl, type SuiteResults } from '../status'
import { startTunnel, stopTunnel } from '../tunnel'

interface NightwatchBrowser {
  sessionId?: string | null
  currentTest?: { name?: string; module?: string; group?: string; results?: SuiteResults }
  options?: { desiredCapabilities?: Record<string, unknown> }
  capabilities?: Record<string, unknown>
}

type Settings = Record<string, unknown> & { desiredCapabilities?: Record<string, unknown>; webdriver?: { host?: string } }

const state: { tunnelStarted: boolean; sessionId?: string } = { tunnelStarted: false }

function currentBrowser(): NightwatchBrowser | undefined {
  return (globalThis as { browser?: NightwatchBrowser }).browser
}

function pluginSettings(settings: Settings | undefined): PluginSettings | undefined {
  return settings?.[PLUGIN_NAME] as PluginSettings | undefined
}

function isTestingBot(settings: Settings | undefined): boolean {
  if (pluginSettings(settings)) return true
  const host = settings?.webdriver?.host ?? ''
  return /testingbot\.com$/.test(host) || !!settings?.desiredCapabilities?.['tb:options']
}

function log(message: string): void {
  console.log(`[${PLUGIN_NAME}] ${message}`)
}

const globals = {
  // Give the REST call and the tunnel time.
  asyncHookTimeout: 120000,

  async before(settings: Settings): Promise<void> {
    const tunnel = pluginSettings(settings)?.tunnel
    if (!tunnel || state.tunnelStarted) return
    const started = Date.now()
    await startTunnel(tunnel)
    state.tunnelStarted = true
    log(`TestingBot Tunnel "${tunnel.tunnelIdentifier}" ready after ${((Date.now() - started) / 1000).toFixed(1)}s`)
  },

  async after(): Promise<void> {
    if (!state.tunnelStarted) return
    await stopTunnel()
    state.tunnelStarted = false
  },

  async beforeEach(settings: Settings): Promise<void> {
    if (!isTestingBot(settings)) return
    state.sessionId = currentBrowser()?.sessionId ?? undefined
  },

  async afterEach(settings: Settings): Promise<void> {
    if (!isTestingBot(settings)) return
    const options = pluginSettings(settings) ?? {}
    const browser = currentBrowser()
    const sessionId = state.sessionId ?? browser?.sessionId ?? undefined
    state.sessionId = undefined
    if (!sessionId || options.reportStatus === false) return
    const test = browser?.currentTest
    const outcome = suiteOutcome(test?.results)
    const name = options.name ?? test?.module ?? test?.name
    try {
      await reportSession({ sessionId, name, outcome })
      if (options.printLinks !== false) log(`${outcome.passed ? 'passed' : 'failed'} ${name ?? ''} ${testUrl(sessionId)}`)
    } catch (error) {
      log(`Could not update the TestingBot session ${sessionId}: ${(error as Error).message}`)
    }
  }
}

export = globals
