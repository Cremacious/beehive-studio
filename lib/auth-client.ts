import { createAuthClient } from 'better-auth/react'

export const authClient = createAuthClient({
  // In the browser, always target the current page's origin so auth fetches are
  // same-origin (no CORS) no matter which host (apex vs www) served the page.
  // Hardcoding NEXT_PUBLIC_APP_URL here baked the www host into the bundle and
  // caused cross-origin requests + a preflight redirect on the apex deploy.
  // The server's BETTER_AUTH_URL still governs the OAuth callback host.
  baseURL:
    typeof window !== 'undefined'
      ? window.location.origin
      : (process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'),
})

export const { useSession, signIn, signUp, signOut } = authClient
