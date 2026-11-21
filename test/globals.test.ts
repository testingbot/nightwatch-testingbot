import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const launcher = vi.hoisted(() => ({
  downloadAndRunAsync: vi.fn(async () => ({ pid: 1 })),
  killAllAsync: vi.fn(async () => {})
}))
vi.mock('testingbot-tunnel-launcher', () => ({ default: launcher, ...launcher }))

const api = vi.hoisted(() => ({ updateTest: vi.fn(async () => ({})), options: [] as unknown[] }))
vi.mock('testingbot-api', () => {
  class TestingBot {
    constructor(options: unknown) {
      api.options.push(options)
    }
    updateTest = api.updateTest
  }
  return { default: TestingBot }
})

import globals from '../src/nightwatch/globals'
import { PLUGIN_NAME } from '../src/settings'

const tbSettings = (plugin: Record<string, unknown> = {}) => ({ [PLUGIN_NAME]: { reportStatus: true, printLinks: true, tunnel: false, ...plugin }, webdriver: { host: 'hub.testingbot.com' } })

describe('plugin globals', () => {
  beforeEach(() => {
    process.env.TESTINGBOT_KEY = 'k'
    process.env.TESTINGBOT_SECRET = 's'
    vi.spyOn(console, 'log').mockImplementation(() => {})
  })
  afterEach(() => {
    vi.clearAllMocks()
    vi.restoreAllMocks()
    delete (globalThis as any).browser
  })

  it('starts the tunnel in before and stops it in after', async () => {
    await globals.before(tbSettings({ tunnel: { tunnelIdentifier: 'id', verbose: true } }))
    await globals.before(tbSettings({ tunnel: { tunnelIdentifier: 'id' } }))
    expect(launcher.downloadAndRunAsync).toHaveBeenCalledTimes(1)
    expect(launcher.downloadAndRunAsync).toHaveBeenCalledWith({ tunnelIdentifier: 'id', verbose: true, apiKey: 'k', apiSecret: 's' })
    await globals.after()
    await globals.after()
    expect(launcher.killAllAsync).toHaveBeenCalledTimes(1)
  })

  it('does nothing in before without a tunnel', async () => {
    await globals.before(tbSettings())
    await globals.after()
    expect(launcher.downloadAndRunAsync).not.toHaveBeenCalled()
    expect(launcher.killAllAsync).not.toHaveBeenCalled()
  })

  it('reports the suite with the session id captured in beforeEach', async () => {
    ;(globalThis as any).browser = { sessionId: 'sess-1', currentTest: { module: 'login', results: { failed: 1, testcases: { works: { failed: 1, lastError: { message: 'nope' } } } } } }
    await globals.beforeEach(tbSettings())
    ;(globalThis as any).browser.sessionId = null // session already ended
    await globals.afterEach(tbSettings())
    expect(api.updateTest).toHaveBeenCalledWith({ 'test[success]': '0', 'test[status_message]': 'Failed: works: nope', 'test[name]': 'login' }, 'sess-1')
    expect((console.log as any).mock.calls[0][0]).toContain('https://testingbot.com/members/tests/sess-1')
  })

  it('uses the fixed name and can be turned off', async () => {
    ;(globalThis as any).browser = { sessionId: 'sess-2', currentTest: { module: 'm', results: { testcases: { a: { passed: 1 } } } } }
    await globals.beforeEach(tbSettings({ name: 'Fixed' }))
    await globals.afterEach(tbSettings({ name: 'Fixed' }))
    expect(api.updateTest).toHaveBeenCalledWith(expect.objectContaining({ 'test[name]': 'Fixed', 'test[success]': '1' }), 'sess-2')

    api.updateTest.mockClear()
    await globals.beforeEach(tbSettings({ reportStatus: false }))
    await globals.afterEach(tbSettings({ reportStatus: false }))
    expect(api.updateTest).not.toHaveBeenCalled()
  })

  it('ignores environments that do not run on TestingBot', async () => {
    ;(globalThis as any).browser = { sessionId: 'local', currentTest: { module: 'm', results: {} } }
    await globals.beforeEach({ webdriver: { host: 'localhost' } })
    await globals.afterEach({ webdriver: { host: 'localhost' } })
    expect(api.updateTest).not.toHaveBeenCalled()
  })

  it('logs instead of failing the run when the REST call fails', async () => {
    api.updateTest.mockRejectedValueOnce(new Error('HTTP 500'))
    ;(globalThis as any).browser = { sessionId: 'sess-3', currentTest: { module: 'm', results: {} } }
    await globals.beforeEach(tbSettings())
    await expect(globals.afterEach(tbSettings())).resolves.toBeUndefined()
    expect((console.log as any).mock.calls.at(-1)[0]).toContain('Could not update the TestingBot session sess-3: HTTP 500')
  })

  it('skips suites without a session', async () => {
    ;(globalThis as any).browser = { sessionId: null, currentTest: { module: 'm', results: {} } }
    await globals.beforeEach(tbSettings())
    await globals.afterEach(tbSettings())
    expect(api.updateTest).not.toHaveBeenCalled()
  })
})
