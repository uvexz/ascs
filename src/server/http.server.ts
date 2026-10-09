import { check, HttpError } from './security.server'

export async function body(request: Request): Promise<unknown> {
  check(request.body, 400, '请求内容为空')
  const reader = request.body.getReader()
  const chunks: Uint8Array[] = []
  let size = 0
  for (;;) {
    const part = await reader.read()
    if (part.done) break
    size += part.value.byteLength
    if (size > 24000) {
      await reader.cancel()
      throw new HttpError(413, '请求内容过大')
    }
    chunks.push(part.value)
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown
  } catch {
    throw new HttpError(400, 'JSON 格式错误')
  }
}
export const params = (request: Request) =>
  Object.fromEntries(new URL(request.url).searchParams)
export const json = (
  value: unknown,
  status = 200,
  extra: Record<string, string> = {},
) =>
  Response.json(value, {
    status,
    headers: {
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      ...extra,
    },
  })
