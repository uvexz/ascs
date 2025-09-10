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
    const { hostname, name, description } = body

    if (!hostname) {
      return NextResponse.json(
        { error: 'hostname is required' },
        { status: 400 }
      )
    }

    const site = await prisma.site.create({
      data: {
        hostname,
        name: name || hostname,
        description,
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