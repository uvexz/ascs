import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// 获取 AI 配置
export async function GET(request: NextRequest) {
  try {
    await requireAuth(request)

    const aiConfig = await prisma.aIConfig.findFirst()
    return NextResponse.json(aiConfig)
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: '未授权' }, { status: 401 })
    }
    console.error('Error fetching AI config:', error)
    return NextResponse.json({ error: '获取配置失败' }, { status: 500 })
  }
}

// 更新或创建 AI 配置
export async function POST(request: NextRequest) {
  try {
    await requireAuth(request)

    const { id, baseUrl, model, apiKey, isEnabled } = await request.json()

    // 验证必填字段
    if (!baseUrl || !model || !apiKey) {
      return NextResponse.json({ error: '请填写所有必填字段' }, { status: 400 })
    }

    const existingConfig = await prisma.aIConfig.findFirst()

    if (existingConfig) {
      // 更新现有配置
      const updatedConfig = await prisma.aIConfig.update({
        where: { id: existingConfig.id },
        data: {
          baseUrl,
          model,
          apiKey,
          isEnabled: isEnabled ?? true,
          updatedAt: new Date(),
        },
      })
      return NextResponse.json(updatedConfig)
    } else {
      // 创建新配置
      const newConfig = await prisma.aIConfig.create({
        data: {
          baseUrl,
          model,
          apiKey,
          isEnabled: isEnabled ?? true,
        },
      })
      return NextResponse.json(newConfig)
    }
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: '未授权' }, { status: 401 })
    }
    console.error('Error saving AI config:', error)
    return NextResponse.json({ error: '保存配置失败' }, { status: 500 })
  }
}