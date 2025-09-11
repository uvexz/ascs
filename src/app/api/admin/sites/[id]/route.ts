import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json()
    const { hostname, name, description, alternateHostnames } = body
    const siteId = params.id

    if (!hostname) {
      return NextResponse.json(
        { error: 'hostname is required' },
        { status: 400 }
      )
    }

    // 检查站点是否存在
    const existingSite = await prisma.site.findUnique({
      where: { id: siteId },
    })

    if (!existingSite) {
      return NextResponse.json(
        { error: '站点不存在' },
        { status: 404 }
      )
    }

    // 检查域名是否被其他站点使用
    const duplicateSite = await prisma.site.findFirst({
      where: {
        hostname,
        id: { not: siteId },
      },
    })

    if (duplicateSite) {
      return NextResponse.json(
        { error: '该域名已被其他站点使用' },
        { status: 400 }
      )
    }

    const updatedSite = await prisma.site.update({
      where: { id: siteId },
      data: {
        hostname,
        name: name || hostname,
        description,
        alternateHostnames: alternateHostnames || null,
      },
      include: {
        _count: {
          select: { comments: true },
        },
      },
    })

    return NextResponse.json(updatedSite)
  } catch (error) {
    console.error('Error updating site:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const siteId = params.id

    // 检查站点是否存在
    const existingSite = await prisma.site.findUnique({
      where: { id: siteId },
      include: {
        _count: {
          select: { comments: true },
        },
      },
    })

    if (!existingSite) {
      return NextResponse.json(
        { error: '站点不存在' },
        { status: 404 }
      )
    }

    // 删除站点及其所有评论
    await prisma.site.delete({
      where: { id: siteId },
    })

    return NextResponse.json({ 
      message: '站点删除成功',
      deletedComments: existingSite._count.comments 
    })
  } catch (error) {
    console.error('Error deleting site:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}