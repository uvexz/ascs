import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const sites = await prisma.site.findMany({
      include: {
        _count: {
          select: { comments: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json(sites)
  } catch (error) {
    console.error('Error fetching sites:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { hostname, name, description, alternateHostnames } = body

    if (!hostname) {
      return NextResponse.json(
        { error: 'hostname is required' },
        { status: 400 }
      )
    }

    // 检查域名是否已存在
    const existingSite = await prisma.site.findUnique({
      where: { hostname },
    })

    if (existingSite) {
      return NextResponse.json(
        { error: '该域名已存在' },
        { status: 400 }
      )
    }

    const site = await prisma.site.create({
      data: {
        hostname,
        name: name || hostname,
        description,
        alternateHostnames: alternateHostnames || null,
      },
    })

    return NextResponse.json(site, { status: 201 })
  } catch (error) {
    console.error('Error creating site:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}