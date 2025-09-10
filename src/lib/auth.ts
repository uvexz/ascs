import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { NextRequest } from 'next/server'
import { prisma } from './prisma'

const JWT_SECRET = process.env.NEXTAUTH_SECRET || 'your-secret-key'

export interface JWTPayload {
  userId: string
  username: string
  email: string
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12)
}

export async function verifyPassword(password: string, hashedPassword: string): Promise<boolean> {
  return bcrypt.compare(password, hashedPassword)
}

export function generateToken(payload: JWTPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' })
}

export function verifyToken(token: string): JWTPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as JWTPayload
  } catch {
    return null
  }
}

export async function getAuthUser(request: NextRequest): Promise<JWTPayload | null> {
  const token = request.cookies.get('auth-token')?.value
  
  if (!token) {
    return null
  }

  const payload = verifyToken(token)
  if (!payload) {
    return null
  }

  // 验证用户是否仍然存在
  const user = await prisma.user.findUnique({
    where: { id: payload.userId }
  })

  if (!user) {
    return null
  }

  return payload
}

export async function requireAuth(request: NextRequest): Promise<JWTPayload> {
  const user = await getAuthUser(request)
  if (!user) {
    throw new Error('Unauthorized')
  }
  return user
}