import { describe, expect, it } from 'vitest'
import { PLUGIN_NAME, resolveRun, testingbotEnvironment, withTestingBot } from '../src/settings'
import { KEY, SECRET, env } from './helpers'

describe('testingbotEnvironment', () => {
  it('points Nightwatch at the TestingBot hub with basic auth', () => {
    const environment = testingbotEnvironment({ browserName: 'firefox', platformName: 'WIN11' }, { env: env(), build: 'b', name: 'n' }) as any
    expect(environment.webdriver).toMatchObject({ start_process: false, host: 'hub.testingbot.com', port: 443, ssl: true, default_path_prefix: '/wd/hub', username: KEY, access_key: SECRET })
    expect(environment.desiredCapabilities).toEqual({ browserName: 'firefox', browserVersion: 'latest', platformName: 'WIN11', 'tb:options': { build: 'b', name: 'n' } })
  })

  it('never puts the secret in the capabilities', () => {
    const environment = testingbotEnvironment({ browserName: 'chrome' }, { env: env(), tunnelIdentifier: 't' }) as any
    expect(JSON.stringify(environment.desiredCapabilities)).not.toContain(SECRET)
    expect(environment.desiredCapabilities['tb:options']['tunnel-identifier']).toBe('t')
  })

  it('merges shared and per-browser tb:options, per-browser wins', () => {
    const environment = testingbotEnvironment(
      { browserName: 'chrome', 'tb:options': { screenrecorder: false, name: 'browser name' } },
      { env: env(), tbOptions: { screenrecorder: true, seleniumVersion: '4.24.0' }, name: 'shared name' }
    ) as any
    expect(environment.desiredCapabilities['tb:options']).toEqual({ screenrecorder: false, seleniumVersion: '4.24.0', name: 'browser name' })
  })

  it('supports another hub', () => {
    const environment = testingbotEnvironment({ browserName: 'chrome' }, { env: env(), hub: { host: 'localhost', port: 4445, ssl: false } }) as any
    expect(environment.webdriver).toMatchObject({ host: 'localhost', port: 4445, ssl: false })
  })
})

describe('withTestingBot', () => {
  it('adds the plugin and one environment per browser', () => {
    const config = withTestingBot({ src_folders: ['tests'], test_settings: { default: { launch_url: 'https://x' } } }, {
      env: env(),
      build: 'b1',
      browsers: { chrome: { browserName: 'chrome' }, safari: { browserName: 'safari', platformName: 'SEQUOIA' } }
    }) as any
    expect(config.src_folders).toEqual(['tests'])
    expect(config.plugins).toEqual([PLUGIN_NAME])
    expect(Object.keys(config.test_settings)).toEqual(['default', 'testingbot', 'testingbot.chrome', 'testingbot.safari'])
    expect(config.test_settings.default).toEqual({ launch_url: 'https://x' })
    expect(config.test_settings.testingbot.desiredCapabilities.browserName).toBe('chrome')
    expect(config.test_settings['testingbot.safari'].desiredCapabilities).toMatchObject({ browserName: 'safari', platformName: 'SEQUOIA', 'tb:options': { build: 'b1' } })
    expect(config[PLUGIN_NAME]).toEqual({ reportStatus: true, printLinks: true, tunnel: false })
    expect(config.test_settings['testingbot.chrome'][PLUGIN_NAME]).toEqual(config[PLUGIN_NAME])
  })

  it('does not add the plugin twice and keeps other plugins', () => {
    const config = withTestingBot({ plugins: ['@nightwatch/react', PLUGIN_NAME] }, { env: env() })
    expect(config.plugins).toEqual(['@nightwatch/react', PLUGIN_NAME])
  })

  it('defaults to the latest Chrome', () => {
    const config = withTestingBot({}, { env: env() }) as any
    expect(Object.keys(config.test_settings)).toEqual(['testingbot', 'testingbot.chrome'])
    expect(config.test_settings.testingbot.desiredCapabilities).toMatchObject({ browserName: 'chrome', browserVersion: 'latest' })
  })

  it('lets the user override generated environments', () => {
    const config = withTestingBot({ test_settings: { 'testingbot.chrome': { globals: { waitForConditionTimeout: 1 } } } }, { env: env() }) as any
    expect(config.test_settings['testingbot.chrome'].globals).toEqual({ waitForConditionTimeout: 1 })
    expect(config.test_settings['testingbot.chrome'].webdriver.host).toBe('hub.testingbot.com')
  })

  it('uses a custom environment prefix', () => {
    const config = withTestingBot({}, { env: env(), environmentPrefix: 'tb' }) as any
    expect(Object.keys(config.test_settings)).toEqual(['tb', 'tb.chrome'])
  })

  it('configures a tunnel with a stable identifier', () => {
    const e = env()
    const config = withTestingBot({}, { env: e, tunnel: { verbose: true } }) as any
    const id = config.test_settings.testingbot.desiredCapabilities['tb:options']['tunnel-identifier']
    expect(id).toMatch(/^nightwatch-/)
    expect(config[PLUGIN_NAME].tunnel).toEqual({ verbose: true, tunnelIdentifier: id })
    expect(e.TESTINGBOT_NIGHTWATCH_TUNNEL_IDENTIFIER).toBe(id)
    const again = withTestingBot({}, { env: e, tunnel: true }) as any
    expect(again.test_settings.testingbot.desiredCapabilities['tb:options']['tunnel-identifier']).toBe(id)
  })

  it('uses a running tunnel without starting one', () => {
    const config = withTestingBot({}, { env: env(), tunnel: { tunnelIdentifier: 'mine', start: false } }) as any
    expect(config.test_settings.testingbot.desiredCapabilities['tb:options']['tunnel-identifier']).toBe('mine')
    expect(config[PLUGIN_NAME].tunnel).toBe(false)
  })

  it('passes plugin options', () => {
    const config = withTestingBot({}, { env: env(), reportStatus: false, printLinks: false, name: 'Fixed' }) as any
    expect(config[PLUGIN_NAME]).toEqual({ reportStatus: false, printLinks: false, name: 'Fixed', tunnel: false })
  })
})

describe('resolveRun', () => {
  it('uses TESTINGBOT_BUILD, a stable generated build, or none', () => {
    expect(resolveRun({ env: env({ TESTINGBOT_BUILD: 'ci-7' }) }).build).toBe('ci-7')
    const e = env()
    const generated = resolveRun({ env: e }).build
    expect(generated).toMatch(/^nightwatch \d{4}-\d\d-\d\d \d\d:\d\d:\d\d$/)
    expect(resolveRun({ env: e }).build).toBe(generated)
    expect(resolveRun({ env: e, build: false }).build).toBeUndefined()
  })
})
