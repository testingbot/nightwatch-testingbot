export const KEY = 'unit-test-key'
export const SECRET = 'unit-test-secret'

export function env(extra: Record<string, string> = {}): NodeJS.ProcessEnv {
  return { TESTINGBOT_KEY: KEY, TESTINGBOT_SECRET: SECRET, ...extra }
}
