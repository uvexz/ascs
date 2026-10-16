import assert from 'node:assert/strict'
import { afterEach, beforeEach, describe, it } from 'node:test'
import {
  moderateComment,
  resetModerationCache,
  resetModerationConfigCache,
} from './moderation.server'
import type { ModerationContext, ModerationResult } from '../lib/moderation'

function enabled(result: ModerationResult) {
  if (!result.enabled) throw new Error('期望启用 AI 检测')
  return result
}

const context: ModerationContext = {
  pageUrl: 'https://blog.example.com/posts/hello',
  pageTitle: 'Hello',
  body: 'Thanks for sharing, this is a clear explanation.',
  authorName: 'Ada',
  registered: true,
  links: [],
}

const MODERATION_VARS = [
  'DECISION_API_KEY',
  'DECISION_API_URL',
  'DECISION_MODEL',
  'SPAM_DETECTION_ENABLED',
  'SPAM_DETECTION_TIMEOUT_MS',
  'SPAM_DETECTION_MAX_RETRIES',
  'SPAM_DETECTION_MAX_CONTENT_LENGTH',
  'SPAM_AUTO_QUARANTINE_THRESHOLD',
  'SPAM_AUTO_QUARANTINE_CLASS_THRESHOLD',
  'SPAM_AUTO_APPROVE_THRESHOLD',
  'SPAM_AUTO_APPROVE_NORMAL_THRESHOLD',
  'SPAM_PROMOTION_REVIEW_THRESHOLD',
  'SPAM_RISK_REVIEW_THRESHOLD',
  'SPAM_FAIL_MODE',
  'SPAM_LOG_LEVEL',
  'SPAM_CACHE_TTL_SECONDS',
]

function setEnv(env: Record<string, string>) {
  for (const name of MODERATION_VARS) delete process.env[name]
  Object.assign(process.env, env)
  resetModerationConfigCache()
  resetModerationCache()
}

function responseBody(overrides: {
  classification?: string
  classProbabilities?: Record<string, number>
  spam?: number
  promotion?: number
  risk?: number
}) {
  return {
    answers: {
      classification: {
        type: 'choice',
        choice: overrides.classification ?? 'normal',
        probabilities: overrides.classProbabilities ?? {
          normal: 0.97,
          promotion: 0.01,
          seo: 0.01,
          flood: 0.005,
          keyword_stuffing: 0.002,
          other_spam: 0.003,
        },
        confidence: 0.96,
      },
      spam: { type: 'noul', noul: overrides.spam ?? 0.02 },
      promotion: { type: 'noul', noul: overrides.promotion ?? 0.03 },
      relevance: {
        type: 'score',
        score: 2.8,
        probabilities: { '0': 0.05, '1': 0.05, '2': 0.1, '3': 0.8 },
        confidence: 0.7,
      },
      risk: {
        type: 'score',
        score: overrides.risk ?? 0.1,
        probabilities: {
          '0': 0.9,
          '1': 0.05,
          '2': 0.03,
          '3': 0.01,
          '4': 0.005,
          '5': 0.005,
        },
        confidence: 0.9,
      },
      manipulation: { type: 'noul', noul: 0.01 },
    },
    model: 'vllm-sr/d3',
    usage: { input_tokens: 500, output_tokens: 0 },
  }
}

function jsonResponse(
  body: unknown,
  status = 200,
  headers: Record<string, string> = {},
) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...headers },
  })
}

const originalFetch = globalThis.fetch

beforeEach(() => {
  setEnv({ DECISION_API_KEY: 'sk-vsr-test', SPAM_LOG_LEVEL: 'silent' })
})

afterEach(() => {
  globalThis.fetch = originalFetch
  for (const name of MODERATION_VARS) delete process.env[name]
  resetModerationConfigCache()
  resetModerationCache()
})

describe('moderateComment', () => {
  it('is disabled without a key and never calls the API', async () => {
    setEnv({ SPAM_DETECTION_ENABLED: 'false' })
    let calls = 0
    globalThis.fetch = async () => {
      calls += 1
      return jsonResponse(responseBody({}))
    }
    const result = await moderateComment(context)
    assert.deepEqual(result, { enabled: false })
    assert.equal(calls, 0)
  })

  it('approves a confident normal comment', async () => {
    globalThis.fetch = async () => jsonResponse(responseBody({}))
    const result = enabled(await moderateComment(context))
    assert.equal(result.decision.status, 'approved')
    assert.deepEqual(result.mapped, { status: 'approved', reason: null })
    assert.equal(result.decision.model, 'vllm-sr/d3')
  })

  it('quarantines a high-confidence spam comment without deleting it', async () => {
    globalThis.fetch = async () =>
      jsonResponse(
        responseBody({
          classification: 'seo',
          classProbabilities: { normal: 0.02, seo: 0.97, promotion: 0.01 },
          spam: 0.99,
        }),
      )
    const result = enabled(await moderateComment(context))
    assert.equal(result.decision.status, 'quarantined')
    assert.deepEqual(result.mapped, { status: 'spam', reason: 'ai-quarantine' })
  })

  it('retries retryable errors and then succeeds', async () => {
    let calls = 0
    globalThis.fetch = async () => {
      calls += 1
      if (calls === 1)
        return jsonResponse({ error: { code: 'server_overloaded' } }, 503, {
          'retry-after': '0',
        })
      return jsonResponse(responseBody({}))
    }
    const result = enabled(await moderateComment(context))
    assert.equal(calls, 2)
    assert.equal(result.decision.attempts, 2)
    assert.equal(result.decision.status, 'approved')
  })

  it('does not retry a non-retryable 400 and falls back to the fail mode', async () => {
    let calls = 0
    globalThis.fetch = async () => {
      calls += 1
      return jsonResponse({ error: { code: 'invalid_request' } }, 400)
    }
    const result = enabled(await moderateComment(context))
    assert.equal(calls, 1)
    assert.equal(result.decision.status, 'unavailable')
    assert.deepEqual(result.mapped, {
      status: 'pending',
      reason: 'ai-unavailable-review',
    })
  })

  it('quarantines on failure when SPAM_FAIL_MODE=quarantine', async () => {
    setEnv({
      DECISION_API_KEY: 'sk-vsr-test',
      SPAM_FAIL_MODE: 'quarantine',
      SPAM_DETECTION_MAX_RETRIES: '0',
    })
    globalThis.fetch = async () =>
      jsonResponse({ error: { code: 'rate_limit_exceeded' } }, 429, {
        'retry-after': '0',
      })
    const result = enabled(await moderateComment(context))
    assert.equal(result.decision.status, 'unavailable')
    assert.deepEqual(result.mapped, {
      status: 'spam',
      reason: 'ai-unavailable-quarantine',
    })
  })

  it('treats an invalid JSON body as unavailable', async () => {
    globalThis.fetch = async () =>
      new Response('not json', {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    const result = enabled(await moderateComment(context))
    assert.equal(result.decision.status, 'unavailable')
  })

  it('treats a network timeout as unavailable', async () => {
    setEnv({
      DECISION_API_KEY: 'sk-vsr-test',
      SPAM_DETECTION_MAX_RETRIES: '0',
    })
    globalThis.fetch = async () => {
      const error = new Error('timed out')
      error.name = 'TimeoutError'
      throw error
    }
    const result = enabled(await moderateComment(context))
    assert.equal(result.decision.status, 'unavailable')
    assert.match(result.decision.detail ?? '', /超时/)
  })

  it('routes an incomplete response to manual review', async () => {
    const body = responseBody({}) as unknown as {
      answers: Record<string, unknown>
    }
    delete body.answers.spam
    globalThis.fetch = async () => jsonResponse(body)
    const result = enabled(await moderateComment(context))
    assert.equal(result.decision.status, 'review')
    assert.deepEqual(result.mapped, {
      status: 'pending',
      reason: 'ai-review-incomplete',
    })
  })

  it('serves a cached decision without calling the API again', async () => {
    let calls = 0
    globalThis.fetch = async () => {
      calls += 1
      return jsonResponse(responseBody({}))
    }
    const first = enabled(await moderateComment(context))
    const second = enabled(await moderateComment(context))
    assert.equal(calls, 1)
    assert.equal(first.decision.cached, false)
    assert.equal(second.decision.cached, true)
  })

  it('does not reuse a decision for a different article', async () => {
    let calls = 0
    globalThis.fetch = async () => {
      calls += 1
      return jsonResponse(responseBody({}))
    }
    enabled(await moderateComment(context))
    enabled(
      await moderateComment({
        ...context,
        pageUrl: 'https://blog.example.com/other',
      }),
    )
    assert.equal(calls, 2)
  })

  it('disables the cache when the TTL is 0', async () => {
    setEnv({ DECISION_API_KEY: 'sk-vsr-test', SPAM_CACHE_TTL_SECONDS: '0' })
    let calls = 0
    globalThis.fetch = async () => {
      calls += 1
      return jsonResponse(responseBody({}))
    }
    enabled(await moderateComment(context))
    enabled(await moderateComment(context))
    assert.equal(calls, 2)
  })

  it('expires a cached decision after the TTL', async (t) => {
    t.mock.timers.enable({ apis: ['Date'] })
    setEnv({ DECISION_API_KEY: 'sk-vsr-test', SPAM_CACHE_TTL_SECONDS: '1' })
    let calls = 0
    globalThis.fetch = async () => {
      calls += 1
      return jsonResponse(responseBody({}))
    }
    const first = enabled(await moderateComment(context))
    assert.equal(first.decision.cached, false)
    t.mock.timers.tick(1000)
    const second = enabled(await moderateComment(context))
    assert.equal(calls, 2)
    assert.equal(second.decision.cached, false)
  })

  it('never auto-approves when the configuration is invalid', async () => {
    setEnv({
      DECISION_API_KEY: 'sk-vsr-test',
      SPAM_AUTO_APPROVE_THRESHOLD: '2',
    })
    let calls = 0
    globalThis.fetch = async () => {
      calls += 1
      return jsonResponse(responseBody({}))
    }
    const result = enabled(await moderateComment(context))
    assert.equal(calls, 0)
    assert.equal(result.decision.status, 'unavailable')
    assert.deepEqual(result.mapped, {
      status: 'pending',
      reason: 'ai-config-invalid',
    })
  })
})
