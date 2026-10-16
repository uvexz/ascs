// Cap (https://github.com/tiagozip/cap) human verification. Enabled only when
// both CAP_SITE (`https://<instance>/<site_key>/`) and CAP_KEY (secret key) are
// configured. The secret never leaves the server; the endpoint is public.
type CaptchaFailure = { status: 400 | 503; message: string }

/** The widget's WASM solver URLs, exposed to its CAP_CUSTOM_* globals. */
export type CaptchaWasm = { cap: string; hashwx: string }

export function captchaEndpoint(): string | null {
  const site = process.env.CAP_SITE?.trim()
  const key = process.env.CAP_KEY?.trim()
  if (!site || !key) return null
  return site.endsWith('/') ? site : `${site}/`
}

/**
 * Points the widget's proof-of-work solver at the Cap instance's own asset
 * server instead of jsdelivr. CAP_SITE is `<instance>/<site_key>/`, so dropping
 * the trailing site-key segment yields the instance URL, whose `/assets`
 * directory serves `cap_wasm_bg.wasm` and `hashwx.wasm`.
 */
export function captchaWasm(): CaptchaWasm | null {
  const endpoint = captchaEndpoint()
  if (!endpoint) return null
  let instance: URL
  try {
    instance = new URL(endpoint)
  } catch {
    return null
  }
  const segments = instance.pathname.split('/').filter(Boolean)
  segments.pop()
  const prefix = segments.length ? `/${segments.join('/')}` : ''
  const base = `${instance.origin}${prefix}/assets/`
  return {
    cap: `${base}cap_wasm_bg.wasm`,
    hashwx: `${base}hashwx.wasm`,
  }
}

export async function captchaFailure(
  token: string | null | undefined,
): Promise<CaptchaFailure | null> {
  const endpoint = captchaEndpoint()
  if (!endpoint) return null
  if (!token) return { status: 400, message: '请完成人机验证' }
  let success = false
  try {
    const response = await fetch(new URL('siteverify', endpoint), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ secret: process.env.CAP_KEY, response: token }),
      signal: AbortSignal.timeout(5_000),
    })
    if (!response.ok) throw new Error(`cap siteverify ${response.status}`)
    const result: unknown = await response.json()
    success =
      typeof result === 'object' &&
      result !== null &&
      (result as { success?: unknown }).success === true
  } catch {
    return { status: 503, message: '人机验证服务暂时不可用，请稍后重试' }
  }
  return success ? null : { status: 400, message: '人机验证失败，请重试' }
}
