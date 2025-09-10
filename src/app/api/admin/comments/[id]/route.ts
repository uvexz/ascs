import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await requireAuth(request)
  } catch (error) {
    return NextResponse.json({ error: '未授权' }, { status: 401 })
  }

  try {

    const commentId = params.id

    // 删除评论及其所有回复
    await prisma.comment.deleteMany({
      where: {
        OR: [
          { id: commentId },
          { parentId: commentId }
        ]
      }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting comment:', error)
    return NextResponse.json({ error: '删除评论失败' }, { status: 500 })
  }
}