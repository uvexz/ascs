// Cap (https://github.com/tiagozip/cap) human verification. Enabled only when
// both CAP_SITE (`https://<instance>/<site_key>/`) and CAP_KEY (secret key) are
// configured. The secret never leaves the server; the endpoint is public.
type CaptchaFailure = { status: 400 | 503; message: string }

export function captchaEndpoint(): string | null {
  const site = process.env.CAP_SITE?.trim()
  const key = process.env.CAP_KEY?.trim()
  if (!site || !key) return null
  return site.endsWith('/') ? site : `${site}/`
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
