import { NextResponse } from 'next/server'
import { getCapInstance } from '@/lib/cap-instance'

export async function POST() {
    try {
        const challenge = await getCapInstance().createChallenge()
        return NextResponse.json(challenge)
    } catch (error) {
        console.error('Error creating cap challenge:', error)
        return NextResponse.json(
            { error: 'Failed to create challenge' },
            { status: 500 }
        )
    }
}