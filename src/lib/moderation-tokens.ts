import { prisma } from './prisma'
import crypto from 'crypto'

export interface ModerationTokenData {
  id: string
  token: string
  action: 'approve' | 'delete'
  isUsed: boolean
  createdAt: Date
  expiresAt: Date
  commentId: string
}

/**
 * 生成一次性审核代码
 * @param commentId 评论ID
 * @param action 操作类型：'approve' 或 'delete'
 * @param expiresIn 过期时间（小时），默认24小时
 * @returns 生成的token
 */
export async function generateModerationToken(
  commentId: string,
  action: 'approve' | 'delete',
  expiresIn: number = 24
): Promise<string> {
  // 生成随机token
  const token = crypto.randomBytes(32).toString('hex')
  
  // 计算过期时间
  const expiresAt = new Date()
  expiresAt.setHours(expiresAt.getHours() + expiresIn)

  try {
    // 保存token到数据库
    await prisma.moderationToken.create({
      data: {
        token,
        action,
        expiresAt,
        commentId,
      },
    })

    return token
  } catch (error) {
    console.error('Failed to generate moderation token:', error)
    throw new Error('生成审核代码失败')
  }
}

/**
 * 验证一次性审核代码
 * @param token 要验证的token
 * @returns 验证结果和token数据
 */
export async function verifyModerationToken(
  token: string
): Promise<{ isValid: boolean; tokenData?: ModerationTokenData; error?: string }> {
  try {
    // 查找token
    const tokenData = await prisma.moderationToken.findUnique({
      where: { token },
    })

    if (!tokenData) {
      return { isValid: false, error: '无效的审核代码' }
    }

    // 检查是否已使用
    if (tokenData.isUsed) {
      return { isValid: false, error: '审核代码已使用' }
    }

    // 检查是否过期
    if (new Date() > tokenData.expiresAt) {
      return { isValid: false, error: '审核代码已过期' }
    }

    return { isValid: true, tokenData }
  } catch (error) {
    console.error('Error verifying moderation token:', error)
    return { isValid: false, error: '验证审核代码时发生错误' }
  }
}

/**
 * 标记token为已使用
 * @param token 要标记的token
 * @returns 是否成功
 */
export async function markTokenAsUsed(token: string): Promise<boolean> {
  try {
    await prisma.moderationToken.update({
      where: { token },
      data: { isUsed: true },
    })
    return true
  } catch (error) {
    console.error('Error marking token as used:', error)
    return false
  }
}

/**
 * 清理过期的token
 * @returns 清理的token数量
 */
export async function cleanupExpiredTokens(): Promise<number> {
  try {
    const result = await prisma.moderationToken.deleteMany({
      where: {
        expiresAt: {
          lt: new Date(),
        },
      },
    })
    return result.count
  } catch (error) {
    console.error('Error cleaning up expired tokens:', error)
    return 0
  }
}

/**
 * 为评论生成审核和删除链接
 * @param commentId 评论ID
 * @returns 包含approveUrl和deleteUrl的对象
 */
export async function generateModerationLinks(commentId: string): Promise<{
  approveUrl: string
  deleteUrl: string
}> {
  const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000'
  
  // 生成审核token
  const approveToken = await generateModerationToken(commentId, 'approve')
  const deleteToken = await generateModerationToken(commentId, 'delete')
  
  return {
    approveUrl: `${baseUrl}/api/comments/${commentId}/${approveToken}/approve`,
    deleteUrl: `${baseUrl}/api/comments/${commentId}/${deleteToken}/delete`,
  }
}