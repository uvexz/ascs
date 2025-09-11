import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createCorsResponse, handleOptions } from '@/lib/cors'

export async function OPTIONS() {
  return handleOptions()
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const hostname = searchParams.get('host')

    if (!hostname) {
      return createCorsResponse(
        { error: 'host parameter is required' },
        { status: 400 }
      )
    }

    // 首先尝试通过主域名查找
    let site = await prisma.site.findUnique({
      where: { hostname },
    })

    // 如果没有找到，尝试通过备用域名查找
    if (!site) {
      const allSites = await prisma.site.findMany({
        where: {
          alternateHostnames: {
            not: null,
          },
        },
      })

      // 检查是否有站点的备用域名包含当前域名
      const foundSite = allSites.find(s => {
        if (!s.alternateHostnames) return false
        const alternateDomains = s.alternateHostnames.split(',').map(d => d.trim())
        return alternateDomains.includes(hostname)
      })
      
      if (foundSite) {
        site = foundSite
      }
    }

    if (!site) {
      return createCorsResponse(
        {
          error: '站点不存在。请在后台创建站点，或将本网站域名添加至现有站点的备用域名。',
          code: 'SITE_NOT_FOUND'
        },
        { status: 404 }
      )
    }

    return createCorsResponse(site)
  } catch (error) {
    console.error('Error fetching site:', error)
    return createCorsResponse(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}