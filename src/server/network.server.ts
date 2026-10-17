import { lookup } from 'node:dns/promises'
import { isIP } from 'node:net'

/**
 * Reject loopback, private, link-local, CGNAT and other non-public addresses.
 * The SMTP test endpoint opens a server-side connection to an admin-supplied
 * host, so without this check an instance admin could probe the internal
 * network (SSRF). This is a best-effort check performed when the host is saved
 * and tested; DNS rebinding between those moments is out of scope.
 */
function isNonPublicAddress(address: string): boolean {
  const version = isIP(address)
  if (version === 4) {
    const [a = 0, b = 0] = address.split('.').map(Number)
    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 198 && (b === 18 || b === 19)) ||
      a >= 224
    )
  }
  if (version === 6) {
    const lower = address.toLowerCase()
    if (lower.startsWith('::ffff:')) return isNonPublicAddress(lower.slice(7))
    return (
      lower === '::' ||
      lower === '::1' ||
      lower.startsWith('fc') ||
      lower.startsWith('fd') ||
      lower.startsWith('fe8') ||
      lower.startsWith('fe9') ||
      lower.startsWith('fea') ||
      lower.startsWith('feb')
    )
  }
  return true
}

const nonPublicSuffixes = ['.localhost', '.local', '.internal']

/** Returns a user-facing problem message, or null when the host is public. */
export async function publicSmtpHostProblem(
  host: string,
): Promise<string | null> {
  const normalized = host.trim().toLowerCase().replace(/\.$/, '')
  if (!normalized) return 'SMTP 主机不能为空'
  if (
    normalized === 'localhost' ||
    nonPublicSuffixes.some((suffix) => normalized.endsWith(suffix))
  )
    return 'SMTP 主机不能指向本机或内网地址'
  if (isIP(normalized))
    return isNonPublicAddress(normalized)
      ? 'SMTP 主机不能指向本机或内网地址'
      : null
  let addresses: Array<{ address: string; family: number }>
  try {
    addresses = await lookup(normalized, { all: true, verbatim: true })
  } catch {
    return 'SMTP 主机无法解析，请检查域名'
  }
  if (
    !addresses.length ||
    addresses.some(({ address }) => isNonPublicAddress(address))
  )
    return 'SMTP 主机不能指向本机或内网地址'
  return null
}
