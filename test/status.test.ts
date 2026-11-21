import { describe, expect, it, vi } from 'vitest'
import { reportSession, suiteOutcome, testUrl } from '../src/status'

describe('suiteOutcome', () => {
  it('passes when no test case failed', () => {
    expect(suiteOutcome({ passed: 3, failed: 0, errors: 0, testcases: { a: { passed: 1, failed: 0, errors: 0 }, b: { passed: 2, failed: 0 } } })).toEqual({ passed: true, message: '2 test cases passed', failedTestcases: [] })
    expect(suiteOutcome({ testcases: { a: { passed: 1 } } }).message).toBe('1 test case passed')
    expect(suiteOutcome(undefined)).toEqual({ passed: true, message: 'Passed', failedTestcases: [] })
  })

  it('fails with the failed test cases and their first error line', () => {
    const outcome = suiteOutcome({
      failed: 1,
      errors: 1,
      testcases: {
        ok: { passed: 1, failed: 0 },
        title: { failed: 1, assertions: [{ message: 'fine', failure: false }, { message: '\u001b[31mTitle mismatch\u001b[0m\nstack', failure: 'Expected x' }] },
        crash: { errors: 1, lastError: { message: 'TypeError: boom' } },
        status: { status: 'fail' }
      }
    })
    expect(outcome.passed).toBe(false)
    expect(outcome.failedTestcases).toEqual(['title', 'crash', 'status'])
    expect(outcome.message).toBe('Failed: title: Title mismatch; crash: TypeError: boom; status')
  })

  it('fails on suite-level failures without test cases (for example a failing before hook)', () => {
    expect(suiteOutcome({ failed: 0, errors: 1, testcases: {} })).toEqual({ passed: false, message: '0 failed, 1 errors', failedTestcases: [] })
  })

  it('truncates long messages', () => {
    const outcome = suiteOutcome({ testcases: { t: { failed: 1, lastError: { message: 'x'.repeat(5000) } } } })
    expect(outcome.message.length).toBe(1000)
  })
})

describe('reportSession', () => {
  it('sends success, name and message to the REST API', async () => {
    const client = { updateTest: vi.fn(async () => ({}) as any) }
    await reportSession({ sessionId: 'abc', name: 'login', outcome: { passed: false, message: 'Failed: x', failedTestcases: ['x'] }, client })
    expect(client.updateTest).toHaveBeenCalledWith({ 'test[success]': '0', 'test[status_message]': 'Failed: x', 'test[name]': 'login' }, 'abc')
  })

  it('leaves the name alone when there is none', async () => {
    const client = { updateTest: vi.fn(async () => ({}) as any) }
    await reportSession({ sessionId: 'abc', outcome: { passed: true, message: 'Passed', failedTestcases: [] }, client })
    expect(client.updateTest).toHaveBeenCalledWith({ 'test[success]': '1', 'test[status_message]': 'Passed' }, 'abc')
  })

  it('builds dashboard links', () => {
    expect(testUrl('abc')).toBe('https://testingbot.com/members/tests/abc')
  })
})
