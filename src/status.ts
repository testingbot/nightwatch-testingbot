import TestingBot from 'testingbot-api'
import { getCredentials, type CredentialOptions } from './credentials'

/** The parts of Nightwatch's `browser.currentTest.results` this plugin reads. */
export interface SuiteResults {
  passed?: number
  failed?: number
  errors?: number
  skipped?: number
  testcases?: Record<string, TestcaseResult>
}

export interface TestcaseResult {
  passed?: number
  failed?: number
  errors?: number
  skipped?: number
  status?: string
  assertions?: Array<{ message?: string; failure?: string | false; fullMsg?: string }>
  lastError?: { message?: string } | null
}

export interface SuiteOutcome {
  passed: boolean
  message: string
  failedTestcases: string[]
}

const MAX_MESSAGE = 1000

// eslint-disable-next-line no-control-regex
const stripAnsi = (text: string): string => text.replace(/\u001b\[[0-9;]*m/g, '')

function testcaseFailed(result: TestcaseResult): boolean {
  if (result.status === 'fail') return true
  return (result.failed ?? 0) > 0 || (result.errors ?? 0) > 0
}

function testcaseReason(result: TestcaseResult): string | undefined {
  const failedAssertion = result.assertions?.find((a) => a.failure)
  const message = result.lastError?.message ?? failedAssertion?.message ?? failedAssertion?.fullMsg
  return message ? stripAnsi(message).split('\n')[0] : undefined
}

/**
 * Pass/fail of a Nightwatch test suite (one TestingBot session): it passes when no test case
 * failed or errored. The message lists the failed test cases.
 */
export function suiteOutcome(results: SuiteResults | undefined): SuiteOutcome {
  const testcases = Object.entries(results?.testcases ?? {})
  const failedTestcases = testcases.filter(([, r]) => testcaseFailed(r)).map(([name]) => name)
  const failed = failedTestcases.length > 0 || (results?.failed ?? 0) > 0 || (results?.errors ?? 0) > 0
  if (!failed) {
    const count = testcases.length
    return { passed: true, message: count ? `${count} test case${count === 1 ? '' : 's'} passed` : 'Passed', failedTestcases }
  }
  const lines = failedTestcases.map((name) => {
    const reason = testcaseReason(results!.testcases![name])
    return reason ? `${name}: ${reason}` : name
  })
  const message = lines.length ? `Failed: ${lines.join('; ')}` : `${results?.failed ?? 0} failed, ${results?.errors ?? 0} errors`
  return { passed: false, message: message.slice(0, MAX_MESSAGE), failedTestcases }
}

export interface ReportOptions extends CredentialOptions {
  sessionId: string
  name?: string
  outcome: SuiteOutcome
  /** For tests. */
  client?: Pick<TestingBot, 'updateTest'>
}

/** Sends the name and pass/fail status of a session to the TestingBot REST API. */
export async function reportSession(options: ReportOptions): Promise<void> {
  const client =
    options.client ??
    (() => {
      const { key, secret } = getCredentials(options)
      return new TestingBot({ api_key: key, api_secret: secret })
    })()
  const data: Record<string, string> = {
    'test[success]': options.outcome.passed ? '1' : '0',
    'test[status_message]': options.outcome.message
  }
  if (options.name) data['test[name]'] = options.name
  await client.updateTest(data, options.sessionId)
}

export function testUrl(sessionId: string): string {
  return `https://testingbot.com/members/tests/${sessionId}`
}
