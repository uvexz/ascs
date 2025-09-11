import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const commentId = params.id

    // 检查评论是否存在
    const existingComment = await prisma.comment.findUnique({
      where: { id: commentId },
    })

    if (!existingComment) {
      return NextResponse.json(
        { error: '评论不存在' },
        { status: 404 }
      )
    }

    // 删除评论及其所有回复（级联删除）
    await prisma.comment.delete({
      where: { id: commentId },
    })

    return NextResponse.json({
      message: '评论删除成功'
    })
  } catch (error) {
    console.error('Error deleting comment:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const commentId = params.id
    const body = await request.json()
    const { status } = body

    if (!status || !['APPROVED', 'PENDING', 'REJECTED'].includes(status)) {
      return NextResponse.json(
        { error: '无效的状态值' },
        { status: 400 }
      )
    }

    // 检查评论是否存在
    const existingComment = await prisma.comment.findUnique({
      where: { id: commentId },
    })

    if (!existingComment) {
      return NextResponse.json(
        { error: '评论不存在' },
        { status: 404 }
      )
    }

    // 更新评论状态
    const updatedComment = await prisma.comment.update({
      where: { id: commentId },
      data: { status },
    })

    return NextResponse.json({
      message: '评论状态更新成功',
      comment: updatedComment
    })
  } catch (error) {
    console.error('Error updating comment status:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}