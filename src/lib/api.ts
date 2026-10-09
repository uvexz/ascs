import { getWidgetToken } from './widget-session'

type FieldIssue = { path: Array<string | number>; message: string }

const widgetPaths = ['widget/', 'config', 'comments', 'likes']
const usesWidgetAuth = (path: string) =>
  widgetPaths.some((prefix) => path.startsWith(prefix))

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public issues: Array<FieldIssue> = [],
  ) {
    super(message)
  }
}

export async function api<T>(
  path: string,
  options: {
    method?: string
    body?: unknown
    signal?: AbortSignal
    skipAuth?: boolean
  } = {},
): Promise<T> {
  const token =
    options.skipAuth || !usesWidgetAuth(path) ? '' : getWidgetToken()
  const headers: Record<string, string> = {}
  if (options.body !== undefined) headers['Content-Type'] = 'application/json'
  if (token) headers.Authorization = `Bearer ${token}`
  let response: Response
  try {
    response = await fetch(`/api/v1/${path}`, {
      method: options.method || 'GET',
      credentials: 'same-origin',
      signal: options.signal,
      headers: Object.keys(headers).length ? headers : undefined,
      body:
        options.body !== undefined ? JSON.stringify(options.body) : undefined,
    })
  } catch (error) {
    if (options.signal?.aborted) throw error
    throw new ApiError(
      0,
      '网络连接失败，请检查网络后重试。已填写的内容会保留。',
    )
  }
  let result: { error?: string; issues?: Array<FieldIssue> }
  try {
    result = await response.json()
  } catch {
    throw new ApiError(
      response.status || 502,
      '服务返回了无法读取的内容，请稍后重试。',
    )
  }
  if (!response.ok) {
    const message =
      response.status === 401
        ? '登录已失效，请重新登录后继续。'
        : response.status === 429
          ? '操作过于频繁，请等待一分钟后重试。'
          : result.error || '请求失败，请重试。'
    throw new ApiError(response.status, message, result.issues)
  }
  return result as T
}

export function queryString(
  values: Record<string, string | number | undefined>,
) {
  return new URLSearchParams(
    Object.entries(values)
      .filter(([, value]) => value !== undefined)
      .map(([key, value]) => [key, String(value)]),
  ).toString()
}
export const errorText = (error: unknown) =>
  error instanceof ApiError && error.issues.length
    ? error.issues
        .map((issue) => `${issue.path.join('.')}：${issue.message}`)
        .join('；')
    : error instanceof Error
      ? error.message
      : '操作失败，请重试'
export function fieldError(error: unknown, name: string) {
  if (!(error instanceof ApiError)) return undefined
  const issue = error.issues.find((item) => item.path[0] === name)
  if (!issue) return undefined
  if (/email/i.test(name)) return '请输入有效的邮箱地址。'
  if (name === 'origin')
    return '请输入不含路径的 HTTPS 站点地址，例如 https://blog.example.com。'
  if (['name', 'author'].includes(name)) return '请填写名称，并检查长度限制。'
  if (name === 'body') return '评论内容需为 1–5000 字符。'
  return '请检查此项的格式和长度。'
}
