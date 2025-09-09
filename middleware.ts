import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'

const isProtectedRoute = createRouteMatcher([
  '/dashboard(.*)',
  '/canvas(.*)',
  '/admin(.*)',
])

export default clerkMiddleware(async (auth, req) => {
  if (isProtectedRoute(req)) {
    await auth.protect()
  }

  // 1) Strip sensitive auth params from URL (prevent token/jwt exposure in client history)
  const url = req.nextUrl
  const sensitiveParams = new Set([
    'token',
    'jwt',
    'id_token',
    'access_token',
    'session',
    'session_token',
    'sessionId',
    'authorization',
  ])
  let modified = false
  for (const key of Array.from(url.searchParams.keys())) {
    if (sensitiveParams.has(key)) {
      url.searchParams.delete(key)
      modified = true
    }
  }
  if (modified) {
    const clean = new URL(url.origin + url.pathname)
    const search = url.searchParams.toString()
    if (search) clean.search = search
    return NextResponse.redirect(clean)
  }

  // 2) Add security headers for all requests
  const res = NextResponse.next()
  res.headers.set('X-Frame-Options', 'DENY')
  res.headers.set('X-Content-Type-Options', 'nosniff')
  res.headers.set('Referrer-Policy', 'origin-when-cross-origin')
  res.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()')
  res.headers.set('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload')
  return res
})

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
}