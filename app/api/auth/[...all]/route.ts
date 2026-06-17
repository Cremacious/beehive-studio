import { auth } from '@/lib/auth'
import { toNextJsHandler } from 'better-auth/next-js'
import { signUpLimiter, signInLimiter, forgotPasswordLimiter } from '@/lib/rate-limit'
import { NextRequest, NextResponse } from 'next/server'

const authHandler = toNextJsHandler(auth)

function getClientIp(req: NextRequest): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0].trim() ??
    req.headers.get('x-real-ip') ??
    'unknown'
  )
}

export async function GET(req: NextRequest) {
  return authHandler.GET(req)
}

export async function PATCH(req: NextRequest) {
  return authHandler.PATCH(req)
}

export async function PUT(req: NextRequest) {
  return authHandler.PUT(req)
}

export async function DELETE(req: NextRequest) {
  return authHandler.DELETE(req)
}

export async function POST(req: NextRequest) {
  // Derive the auth sub-path (everything after /api/auth/).
  const url = new URL(req.url)
  const authPath = url.pathname.replace(/^\/api\/auth\//, '')

  if (authPath === 'sign-up/email') {
    const ip = getClientIp(req)
    const { success } = await signUpLimiter.limit(ip)
    if (!success) {
      return NextResponse.json(
        { message: 'Too many sign-up attempts. Please try again later.' },
        { status: 429 },
      )
    }
  }

  if (authPath === 'sign-in/email') {
    const ip = getClientIp(req)
    const { success } = await signInLimiter.limit(ip)
    if (!success) {
      return NextResponse.json(
        { message: 'Too many sign-in attempts. Please try again later.' },
        { status: 429 },
      )
    }
  }

  if (authPath === 'request-password-reset') {
    const ip = getClientIp(req)
    const { success } = await forgotPasswordLimiter.limit(ip)
    if (!success) {
      return NextResponse.json(
        { message: 'Too many reset requests. Please wait 15 minutes and try again.' },
        { status: 429 },
      )
    }
  }

  return authHandler.POST(req)
}
