import { NextRequest, NextResponse } from 'next/server'
import { getCapInstance } from '@/lib/cap-instance'

export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const { token, solutions } = body

        if (!token || !solutions) {
            return NextResponse.json(
                { success: false, error: 'Token and solutions are required' },
                { status: 400 }
            )
        }

        console.log('Redeeming challenge with:', { token, solutions })
        const result = await getCapInstance().redeemChallenge({ token, solutions })
        console.log('Redeem result:', result)
        return NextResponse.json(result)
    } catch (error) {
        console.error('Error redeeming cap challenge:', error)
        return NextResponse.json(
            { success: false, error: 'Failed to redeem challenge' },
            { status: 500 }
        )
    }
}