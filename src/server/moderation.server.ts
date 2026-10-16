import { createHash } from 'node:crypto'
import { setTimeout as delay } from 'node:timers/promises'
import {
  DEFAULT_DECISION_MODEL,
  MODERATION_POLICY_VERSION,
  MODERATION_PROMPT_VERSION,
  buildModerationState,
  decideModeration,
  moderationDbStatus,
  moderationFingerprint,
  moderationQuestions,
  parseModerationConfig,
  parseSystemOneResponse,
} from '../lib/moderation'
import type {
  ModerationConfig,
  ModerationContext,
  ModerationDecision,
  ModerationEnvResult,
  ModerationLogLevel,
  ModerationResult,
  ModerationRuling,
  ModerationScores,
} from '../lib/moderation'

/**
 * Server-side AI comment moderation.
 *
 * Owns everything the pure `src/lib/moderation.ts` deliberately does not: the
 * process environment, the network call to the System One decision API, the TTL
 * cache and the log output. The API key never leaves this module and is never
 * logged; only the caller's already-public context is sent to the provider.
 */

/* --------------------------------------------------------------------------
 * Configuration (parsed once, validated eagerly when enabled)
 * ------------------------------------------------------------------------ */

let envCache: ModerationEnvResult | null = null
let envError: Error | null = null

function moderationEnv(): ModerationEnvResult {
  if (envCache) return envCache
  if (envError) throw envError
  try {
    envCache = parseModerationConfig(process.env)
    return envCache
  } catch (error) {
    envError = error instanceof Error ? error : new Error(String(error))
    throw envError
  }
}

/** Test helper: forget the memoized configuration. */
export function resetModerationConfigCache() {
  envCache = null
  envError = null
}

/* --------------------------------------------------------------------------
 * Logging
 * ------------------------------------------------------------------------ */

const levelRank: Record<ModerationLogLevel, number> = {
  silent: 0,
  error: 1,
  warn: 2,
  info: 3,
  debug: 4,
}

type LogMeta = Record<string, string | number | boolean | null | undefined>

function log(
  level: Exclude<ModerationLogLevel, 'silent'>,
  config: ModerationConfig,
  message: string,
  meta: LogMeta = {},
): void {
  if (levelRank[config.logLevel] < levelRank[level]) return
  const line = `[moderation] ${message}`
  const payload = { ...meta, model: config.model }
  if (level === 'error') console.error(line, payload)
  else if (level === 'warn') console.warn(line, payload)
  else console.log(line, payload)
}

/* --------------------------------------------------------------------------
 * Cache
 * ------------------------------------------------------------------------ */

const MAX_CACHE_ENTRIES = 1000
const cache = new Map<
  string,
  { expiresAt: number; decision: ModerationDecision }
>()

/** Test helper: empty the detection cache. */
export function resetModerationCache() {
  cache.clear()
}

function cacheKey(
  config: ModerationConfig,
  context: ModerationContext,
): string {
  return createHash('sha256')
    .update(
      `${MODERATION_POLICY_VERSION}|${config.model}|${moderationFingerprint(context)}`,
    )
    .digest('hex')
}

function readCache(key: string): ModerationDecision | null {
  const entry = cache.get(key)
  if (!entry) return null
  if (entry.expiresAt <= Date.now()) {
    cache.delete(key)
    return null
  }
  return { ...entry.decision, cached: true }
}

function writeCache(
  key: string,
  decision: ModerationDecision,
  ttlSeconds: number,
): void {
  if (ttlSeconds <= 0) return
  if (cache.size >= MAX_CACHE_ENTRIES) {
    const now = Date.now()
    for (const [entryKey, entry] of cache)
      if (entry.expiresAt <= now) cache.delete(entryKey)
    if (cache.size >= MAX_CACHE_ENTRIES) cache.clear()
  }
  cache.set(key, {
    expiresAt: Date.now() + ttlSeconds * 1000,
    decision: { ...decision, cached: false },
  })
}

/* --------------------------------------------------------------------------
 * Transport
 * ------------------------------------------------------------------------ */

class ModerationRequestError extends Error {
  constructor(
    message: string,
    readonly retryable: boolean,
    readonly status?: number,
  ) {
    super(message)
    this.name = 'ModerationRequestError'
  }
}

const RETRY_BASE_MS = 400
const RETRY_MAX_MS = 2000

function parseRetryAfter(value: string | null): number | null {
  if (!value) return null
  const seconds = Number(value)
  if (Number.isFinite(seconds) && seconds >= 0) return seconds * 1000
  const date = Date.parse(value)
  return Number.isNaN(date) ? null : Math.max(0, date - Date.now())
}

/** Bounded exponential backoff with jitter; a `Retry-After` is honoured but capped. */
function backoffMs(attempt: number, retryAfterMs: number | null): number {
  if (retryAfterMs !== null) return Math.min(retryAfterMs, RETRY_MAX_MS)
  return (
    Math.min(RETRY_BASE_MS * 2 ** (attempt - 1), RETRY_MAX_MS) +
    Math.floor(Math.random() * 200)
  )
}

async function requestSystemOne(
  config: ModerationConfig,
  state: string,
): Promise<{ payload: unknown; attempts: number }> {
  const requestBody = JSON.stringify({
    model: config.model,
    state,
    questions: moderationQuestions(),
  })
  let attempts = 0
  for (;;) {
    attempts += 1
    let failure: ModerationRequestError
    let retryAfterMs: number | null = null
    try {
      const response = await fetch(config.apiUrl, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${config.apiKey}`,
        },
        body: requestBody,
        signal: AbortSignal.timeout(config.timeoutMs),
      })
      if (response.ok) {
        try {
          return { payload: await response.json(), attempts }
        } catch {
          // A 2xx body that is not JSON is a broken upstream answer; retrying a
          // truncated response is cheap and usually succeeds.
          failure = new ModerationRequestError('响应不是合法 JSON', true)
        }
      } else {
        retryAfterMs = parseRetryAfter(response.headers.get('retry-after'))
        failure = new ModerationRequestError(
          `HTTP ${response.status}`,
          response.status === 429 || response.status >= 500,
          response.status,
        )
      }
    } catch (error) {
      // Network failures and aborts are always worth one retry.
      const timedOut =
        error instanceof Error &&
        (error.name === 'TimeoutError' || error.name === 'AbortError')
      failure = new ModerationRequestError(
        timedOut ? '请求超时' : '网络请求失败',
        true,
      )
    }
    if (failure.retryable && attempts <= config.maxRetries) {
      await delay(backoffMs(attempts, retryAfterMs))
      continue
    }
    throw failure
  }
}

/* --------------------------------------------------------------------------
 * Decision assembly
 * ------------------------------------------------------------------------ */

function buildDecision(
  ruling: ModerationRuling,
  scores: ModerationScores | null,
  config: ModerationConfig,
  meta: {
    attempts: number
    latencyMs: number
    cached: boolean
    detail?: string
  },
): ModerationDecision {
  return {
    ...ruling,
    scores,
    model: scores?.model ?? config.model,
    policyVersion: MODERATION_POLICY_VERSION,
    promptVersion: MODERATION_PROMPT_VERSION,
    attempts: meta.attempts,
    latencyMs: meta.latencyMs,
    cached: meta.cached,
    ...(meta.detail ? { detail: meta.detail } : {}),
  }
}

function unavailableDecision(
  detail: string,
  latencyMs: number,
  attempts: number,
): ModerationDecision {
  return {
    status: 'unavailable',
    reasonCode: 'ai-unavailable',
    reason: 'AI 检测服务暂时不可用',
    scores: null,
    model: DEFAULT_DECISION_MODEL,
    policyVersion: MODERATION_POLICY_VERSION,
    promptVersion: MODERATION_PROMPT_VERSION,
    attempts,
    latencyMs,
    cached: false,
    detail,
  }
}

/* --------------------------------------------------------------------------
 * Public entry point
 * ------------------------------------------------------------------------ */

function mappedResult(
  decision: ModerationDecision,
  config: ModerationConfig,
): ModerationResult {
  return {
    enabled: true,
    decision,
    mapped: moderationDbStatus(decision, config.failMode),
  }
}

/**
 * Run AI moderation on one comment. Never throws: a broken configuration or an
 * unreachable provider becomes an `unavailable` decision, which the caller maps
 * through `SPAM_FAIL_MODE` so a comment is never silently auto-approved.
 */
export async function moderateComment(
  context: ModerationContext,
): Promise<ModerationResult> {
  let env: ModerationEnvResult
  try {
    env = moderationEnv()
  } catch (error) {
    console.error(
      '[moderation] 配置无效，AI 检测不可用：',
      error instanceof Error ? error.message : error,
    )
    return {
      enabled: true,
      decision: unavailableDecision('config-invalid', 0, 0),
      mapped: { status: 'pending', reason: 'ai-config-invalid' },
    }
  }
  if (!env.enabled) return { enabled: false }
  const config = env.config

  const key = cacheKey(config, context)
  const cached = readCache(key)
  if (cached) {
    log('debug', config, '缓存命中', {
      status: cached.status,
      reasonCode: cached.reasonCode,
    })
    return mappedResult(cached, config)
  }

  const state = buildModerationState(context, config.maxContentLength)
  const startedAt = Date.now()
  let response: { payload: unknown; attempts: number }
  try {
    response = await requestSystemOne(config, state)
  } catch (error) {
    const latencyMs = Date.now() - startedAt
    const detail = error instanceof Error ? error.message : '未知错误'
    log('warn', config, '检测服务不可用，按 SPAM_FAIL_MODE 处理', {
      detail,
      latencyMs,
    })
    return mappedResult(
      unavailableDecision(detail, latencyMs, config.maxRetries + 1),
      config,
    )
  }

  const latencyMs = Date.now() - startedAt
  const parsed = parseSystemOneResponse(response.payload)
  if (!parsed.ok) {
    if (parsed.reason === 'invalid-response') {
      log('warn', config, '响应结构无效，按不可用处理', {
        detail: parsed.detail,
        latencyMs,
      })
      return mappedResult(
        unavailableDecision(parsed.detail, latencyMs, response.attempts),
        config,
      )
    }
    const ruling: ModerationRuling = {
      status: 'review',
      reasonCode: 'ai-review-incomplete',
      reason: `AI 结果不完整（${parsed.detail}），转人工审核`,
    }
    const decision = buildDecision(ruling, null, config, {
      attempts: response.attempts,
      latencyMs,
      cached: false,
      detail: parsed.detail,
    })
    log('info', config, '检测结果不完整，转人工审核', {
      detail: parsed.detail,
      latencyMs,
      attempts: response.attempts,
    })
    return mappedResult(decision, config)
  }

  const ruling = decideModeration(parsed.scores, config)
  const decision = buildDecision(ruling, parsed.scores, config, {
    attempts: response.attempts,
    latencyMs,
    cached: false,
  })
  writeCache(key, decision, config.cacheTtlSeconds)
  log('info', config, '检测完成', {
    status: decision.status,
    reasonCode: decision.reasonCode,
    spam: parsed.scores.spamProbability,
    promotion: parsed.scores.promotionProbability,
    risk: parsed.scores.riskScore,
    latencyMs,
    attempts: response.attempts,
  })
  return mappedResult(decision, config)
}
