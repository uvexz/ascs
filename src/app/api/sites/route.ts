import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const hostname = searchParams.get('host')

    if (!hostname) {
      return NextResponse.json(
        { error: 'host parameter is required' },
        { status: 400 }
      )
    }

    let site = await prisma.site.findUnique({
      where: { hostname },
    })

    // 如果站点不存在，自动创建一个
    if (!site) {
      site = await prisma.site.create({
        data: {
          hostname,
          name: hostname,
        },
      })
    }

    return NextResponse.json(site)
  } catch (error) {
    console.error('Error fetching site:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}