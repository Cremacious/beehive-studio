// Edge-compatible: uses Web Crypto (globalThis.crypto.subtle) instead of
// node:crypto so the same module is callable from middleware.ts (Edge runtime)
// AND from server actions (Node runtime).

export const ADMIN_COOKIE_NAME = 'beehive_admin_session'
const SESSION_TTL_MS = 24 * 60 * 60 * 1000 // 24h

function getSecret(): string {
  const secret = process.env.ADMIN_SESSION_SECRET
  if (!secret || secret.length < 16) {
    throw new Error(
      'ADMIN_SESSION_SECRET must be set in env (16+ chars). Generate one with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"',
    )
  }
  return secret
}

let cachedKey: { secret: string; key: CryptoKey } | null = null

async function getHmacKey(): Promise<CryptoKey> {
  const secret = getSecret()
  if (cachedKey && cachedKey.secret === secret) return cachedKey.key
  const enc = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  cachedKey = { secret, key }
  return key
}

function toHex(buf: ArrayBuffer): string {
  const view = new Uint8Array(buf)
  let out = ''
  for (let i = 0; i < view.length; i++) out += view[i].toString(16).padStart(2, '0')
  return out
}

function hexToBytes(hex: string): Uint8Array | null {
  if (hex.length % 2 !== 0) return null
  const out = new Uint8Array(hex.length / 2)
  for (let i = 0; i < out.length; i++) {
    const byte = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16)
    if (Number.isNaN(byte)) return null
    out[i] = byte
  }
  return out
}

async function sign(payload: string): Promise<string> {
  const key = await getHmacKey()
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload))
  return toHex(sig)
}

function constantTimeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i]
  return diff === 0
}

/** base64url encode a UTF-8 string without depending on node:Buffer. */
function b64urlEncode(input: string): string {
  // btoa handles ASCII; encode UTF-8 to a binary string first.
  const bytes = new TextEncoder().encode(input)
  let bin = ''
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i])
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function b64urlDecode(input: string): string | null {
  try {
    const pad = input.length % 4 === 0 ? '' : '='.repeat(4 - (input.length % 4))
    const b64 = input.replace(/-/g, '+').replace(/_/g, '/') + pad
    const bin = atob(b64)
    const bytes = new Uint8Array(bin.length)
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
    return new TextDecoder().decode(bytes)
  } catch {
    return null
  }
}

/**
 * Build a signed admin session cookie value.
 * Format: base64url(email)|expiresAtMs|hex(hmac)
 */
export async function buildSessionCookie(email: string): Promise<string> {
  const expiresAt = Date.now() + SESSION_TTL_MS
  const encEmail = b64urlEncode(email)
  const payload = `${encEmail}|${expiresAt}`
  const sig = await sign(payload)
  return `${payload}|${sig}`
}

export interface AdminSession {
  email: string
  expiresAt: number
}

/**
 * Verify a cookie value. Returns the session if valid, null otherwise.
 * Constant-time compare on the signature.
 */
export async function verifySessionCookie(
  cookieValue: string | undefined,
): Promise<AdminSession | null> {
  if (!cookieValue) return null
  const parts = cookieValue.split('|')
  if (parts.length !== 3) return null
  const [encEmail, expiresAtStr, sig] = parts
  const payload = `${encEmail}|${expiresAtStr}`
  const expected = await sign(payload)

  const a = hexToBytes(sig)
  const b = hexToBytes(expected)
  if (!a || !b || !constantTimeEqual(a, b)) return null

  const expiresAt = Number(expiresAtStr)
  if (!Number.isFinite(expiresAt) || expiresAt < Date.now()) return null

  const email = b64urlDecode(encEmail)
  if (!email) return null
  return { email, expiresAt }
}

/**
 * Constant-time string compare for credentials. Edge-safe.
 */
export function safeCompare(a: string, b: string): boolean {
  const aBytes = new TextEncoder().encode(a)
  const bBytes = new TextEncoder().encode(b)
  return constantTimeEqual(aBytes, bBytes)
}
