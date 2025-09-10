import crypto from 'crypto'

export function generateAvatarUrl(email?: string, name?: string): string {
  if (email && email.trim()) {
    // 使用 gravatar 服务
    const hash = crypto.createHash('md5').update(email.trim().toLowerCase()).digest('hex')
    return `https://use.sevencdn.com/avatar/${hash}?d=identicon&s=80`
  } else if (name && name.trim()) {
    // 使用姓名的 base64 编码
    const nameBase64 = Buffer.from(name.trim()).toString('base64')
    return `https://i.sevencdn.com/avatar/${nameBase64}`
  } else {
    // 默认头像
    return `https://use.sevencdn.com/avatar/default?d=identicon&s=80`
  }
}