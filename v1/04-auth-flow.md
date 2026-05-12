# Beehive Books v1 — Authentication & Account Flow

> Source app: `C:\Code\personal\beehive-books-online`
> Auth library: `better-auth ^1.5.5`
> Database: Neon Postgres via Drizzle ORM
> Email: Resend
> OAuth: Google (optional)

---

## 1) better-auth configuration (`lib/auth.ts`)

### Core
- Library: better-auth v1.5.5
- Adapter: Drizzle ORM (Neon Postgres)
- Base URL: `process.env.BETTER_AUTH_URL` (defaults to `http://localhost:3000`)
- Trusted origins: matches `BETTER_AUTH_URL`

### Providers

**Email + password** — always enabled.
- Email verification toggleable via `REQUIRE_EMAIL_VERIFICATION`:
  - `true` → user must verify email before they can use protected routes.
  - `false` → auto sign-in after sign-up; goes straight to `/onboarding`.
- Password reset emails sent via Resend; reset link callback is `/sign-in`. 1-hour token expiry.

**Google OAuth** — enabled when `GOOGLE_AUTH_CLIENT_ID` and `GOOGLE_AUTH_CLIENT_SECRET` are set.
- Account linking enabled with Google as a trusted provider, so a user can later add email/password to a Google account (and vice versa).

### Session policy
- `expiresIn`: 30 days (`60 * 60 * 24 * 30`)
- `updateAge`: 1 day — token quietly refreshed once per day
- Storage: HTTP-only cookies + matching DB row
- Cookie names: `better-auth.session_token` (or `__Secure-better-auth.session_token` over HTTPS)

### Custom user fields layered on top of better-auth's defaults

| Field | Type | Default | Purpose |
|---|---|---|---|
| `username` | string (unique) | `null` | Public handle, 3–20 chars (letters / numbers / `_`) |
| `bio` | string | `null` | ≤200 chars |
| `onboardingComplete` | boolean | `false` | Whether the 3-step onboarding finished |
| `premium` | boolean | `false` | Premium subscription status |
| `role` | enum string | `'member'` | `'member' \| 'moderator' \| 'admin'` |

App-specific columns also live on the `users` table (in `db/schema/auth.ts`, not in better-auth's `additionalFields`):
- `stripeCustomerId`, `stripeSubscriptionId`, `stripePriceId`, `stripeCurrentPeriodEnd`
- `banned`, `bannedAt`, `bannedReason`
- Standard better-auth fields: `image_url`, `email_verified`, `created_at`, `updated_at`

### Email templates
Sent via Resend, configured in `lib/email.ts`:
- **Verification** — Subject: "Verify your Beehive Books email"; branded HTML; "Verify email" button.
- **Password reset** — Subject: "Reset your Beehive Books password"; "Reset password" button; explicit 1-hour expiry note.
- Sender: `Beehive Books <noreply@beehive-books.app>`

---

## 2) Auth pages

All under `app/[locale]/(auth)/`. Layout (`(auth)/layout.tsx`) bounces fully-authenticated + onboarded users to `/home` so they can't see auth pages.

### `/sign-in` — `app/[locale]/(auth)/sign-in/page.tsx`
**Fields:** email, password, "show password" toggle.
**Buttons:** "Continue with Google", "Sign in", link to `/forgot-password`.
**On submit:** `signIn.email({ email, password })` from `auth-client`.
- Success → full-page navigation to `/home` (so the cookie travels on the next request).
- Failure → inline error.
- If query string contains `?reset=success`, shows a success banner.

### `/sign-up` — `app/[locale]/(auth)/sign-up/page.tsx`
**Fields:** email, password (with strength meter), confirm password.
**Client-side rules:** ≥8 chars, ≥1 uppercase, ≥1 number. Strength indicator: 1 (weak) / 2 (fair) / 3 (strong).
**Buttons:** "Continue with Google", "Create account", link to `/sign-in`.
**On submit:** `signUp.email({ name: email.split('@')[0], email, password })`.
- If `NEXT_PUBLIC_REQUIRE_EMAIL_VERIFICATION === 'true'` → sends a verification email and shows "check your inbox".
- Else → auto-signs in and routes to `/onboarding`.

### `/forgot-password` — `app/[locale]/(auth)/forgot-password/page.tsx`
**Field:** email.
**On submit:** `authClient.requestPasswordReset({ email, redirectTo: '/reset-password' })`. Always shows "check your inbox" regardless of whether the email exists (no enumeration).

### `/reset-password` — `app/[locale]/(auth)/reset-password/page.tsx`
**URL:** `/reset-password?token=<verification-token>` (link from email).
**Fields:** new password, confirm password (≥8 chars and must match).
**On submit:** `authClient.resetPassword({ newPassword, token })`.
- Success → redirects to `/sign-in?reset=success`.
- Failure → "Failed to reset password. The link may have expired."

### `/onboarding` — `app/[locale]/(auth)/onboarding/page.tsx`
Server-side guard: requires session; loads existing username from DB. Three-step wizard via `OnboardingFlow`:
1. **Username** — debounced (400ms) availability check via `checkUsernameAvailableAction`. Live valid/taken indicator. "Next" only enables when valid.
2. **Bio** *(optional)* — textarea, ≤200 chars. "Next" or "Skip".
3. **Photo** *(optional)* — Cloudinary upload via `useCloudinaryUpload('avatars', userId)`. Shows initial as fallback. "Finish" or "Skip for now".

Submit calls `completeOnboarding(...)` which sets `onboardingComplete = true` and updates `username`, `bio`, `image`, `updatedAt`. On success → full-page navigation to `/home`.

---

## 3) Sign-up flow — step by step

### Email/password
1. User lands on `/sign-up` (auth layout bounces signed-in users away).
2. User enters email + password + confirm; client validates strength.
3. Client calls `signUp.email({ name, email, password })`.
4. better-auth on the server:
   - Validates email + password.
   - Checks for existing email.
   - Hashes the password (bcrypt).
   - Inserts a row in `users` and one in `account` (provider = `password`).
   - If email verification is enabled, inserts a `verification` row.
5. **If verification required**, Resend sends the verification email with `/api/auth/verify-email?token=...`.
6. User clicks the link → token validated → `users.emailVerified = true` → redirected to `/sign-in` (configured callback).
7. User signs in (step-by-step below).
8. User is routed to `/onboarding`, completes the 3 steps.
9. `onboardingComplete = true` → routed to `/home`.

### Google OAuth
1. User clicks "Continue with Google" on `/sign-up` (or `/sign-in`).
2. Client: `signIn.social({ provider: 'google', callbackURL: '/home' })`.
3. Standard OAuth round-trip.
4. Server callback: `app/api/auth/[...all]/route.ts`.
5. better-auth either creates a new user (Google verifies the email for us) or links the Google account to an existing email account.
6. Session is created, cookie is set, and the user lands at `/home` (or `/onboarding` if they're new and haven't onboarded yet).

---

## 4) Sign-in flow — step by step

### Email/password
1. User opens `/sign-in`.
2. Enters email + password; clicks "Sign in".
3. Client: `signIn.email({ email, password })`.
4. Server: queries `account` for `provider = 'password'` matching the email; bcrypt-compares the password.
5. On success: better-auth generates a session token, inserts a row into `session` (with `expiresAt`, `userId`, `ipAddress`, `userAgent`), sets the HTTP-only cookie.
6. Client does a full-page navigation to `/home` so the cookie is included on the next request.
7. The `(app)` layout reads the session, checks `emailVerified` (if required) and `onboardingComplete`, and either:
   - lets the user in,
   - redirects to `/sign-in` (unverified), or
   - redirects to `/onboarding`.

### Google OAuth
Same as the OAuth path under sign-up — there's no separate flow for "sign-in vs sign-up" in OAuth. Existing accounts get a session; new accounts are created on the fly.

---

## 5) Session checking

### Server (server components + server actions)
**`lib/require-auth.ts`** is the canonical helper:

```ts
export async function requireAuth(): Promise<string> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) throw new Error('Unauthorized');

  const userData = await db.query.users.findFirst({
    where: eq(users.id, session.user.id),
    columns: { banned: true },
  });
  if (userData?.banned) throw new Error('Your account has been suspended.');

  return session.user.id;
}
```

There's also `getOptionalUserId()` for endpoints that work for both signed-in and signed-out users.

Server components do the same `auth.api.getSession({ headers: await headers() })` call directly when they need the full session object.

### Client (React)
`lib/auth-client.ts` exports better-auth's React hooks:

```ts
export const { useSession, signIn, signUp, signOut } = authClient;

const { data: session, isPending } = useSession();
const user = session?.user;
```

`session.user` includes the custom fields (`username`, `bio`, `role`, `premium`, etc.).

---

## 6) Middleware (`middleware.ts`)

Runs on every request and does several jobs:

1. **Strip the leading locale segment** (`/es`, `/fr`, …) before route matching, so subsequent checks work on the canonical path.
2. **Rate limiting** (Upstash) — separate buckets per surface:
   - `/api/auth/sign-up` → `signUpLimiter` (strict)
   - `/api/auth/sign-in` → `signInLimiter` (strict)
   - `/api/stripe/*` → `checkoutLimiter` (excluding webhook)
   - `/api/*` (general) → `apiLimiter`
   - Page routes for unauthenticated users → `pageLimiter`
   - Returns `429` when exceeded.
3. **Block known malicious user agents** (SQLMap, Nikto, Nmap, etc.) → `403`.
4. **Session-aware redirects**:
   - Reads `better-auth.session_token` (or the `__Secure-` variant).
   - Authenticated user at `/` → redirect to `/home`.
   - Unauthenticated user at a protected route → redirect to `/sign-in`.
   - For protected routes, fetches the full session via `/api/auth/get-session` to evaluate `onboardingComplete` and (if enabled) `emailVerified`:
     - `onboardingComplete === false` → redirect to `/onboarding`.
     - `emailVerified === false` (when verification is required) → redirect to `/sign-in`.

**Public routes** (no auth required): `/`, `/sign-in`, `/sign-up`, `/forgot-password`, `/reset-password`, `/explore`, `/books`, `/u/:username`, `/terms`, `/privacy`, `/dmca`, `/cookies`. Everything else under `/[locale]/...` is protected.

---

## 7) Database schema for auth (`db/schema/auth.ts`)

### `users`
```ts
id                       text primary key
name                     text
email                    text not null (unique)
emailVerified            boolean default false
image                    text          // image_url
username                 text unique
bio                      text
onboardingComplete       boolean default false
premium                  boolean default false
role                     enum('member' | 'moderator' | 'admin') default 'member'
stripeCustomerId         text unique
stripeSubscriptionId     text unique
stripePriceId            text
stripeCurrentPeriodEnd   timestamp
createdAt                timestamp default now() not null
updatedAt                timestamp default now() not null
banned                   boolean default false
bannedAt                 timestamp
bannedReason             text
```

### `session`
```ts
id          text primary key
expiresAt   timestamp not null
token       text not null (unique)
createdAt   timestamp not null
updatedAt   timestamp not null
ipAddress   text
userAgent   text
userId      text not null references users(id) on delete cascade
```

### `account` — one row per provider attached to a user
```ts
id                       text primary key
accountId                text not null    // provider-specific user id
providerId               text not null    // 'password', 'google', ...
userId                   text not null references users(id) on delete cascade
password                 text             // bcrypt hash, present for 'password' provider
accessToken              text
refreshToken             text
idToken                  text
accessTokenExpiresAt     timestamp
refreshTokenExpiresAt    timestamp
scope                    text
createdAt                timestamp not null
updatedAt                timestamp not null
```

### `verification` — one-time tokens (email verification + password reset)
```ts
id          text primary key
identifier  text not null   // email or user id
value       text not null   // token
expiresAt   timestamp not null
createdAt   timestamp
updatedAt   timestamp
```

---

## 8) Email verification flow

When `REQUIRE_EMAIL_VERIFICATION === 'true'`:

1. After sign-up, better-auth calls `sendVerificationEmail(email, verificationUrl)` (Resend).
2. The email contains a button linking to `/api/auth/verify-email?token=<token>`.
3. better-auth validates the token (must exist in `verification`, must not be expired, identifier must match the email).
4. If valid → `users.emailVerified = true`, the verification row is deleted, the user is redirected to `/sign-in` (per `emailVerification.callbackURL`).
5. If invalid/expired → an error is shown; the user can request a new verification email from `/sign-in`.
6. The middleware blocks unverified users from protected routes by sending them back to `/sign-in`.

---

## 9) Password reset flow

1. User goes to `/forgot-password`, enters their email.
2. Client: `authClient.requestPasswordReset({ email, redirectTo: '/reset-password' })`.
3. Server (better-auth): if a user with that email exists, inserts a `verification` row and sends `sendPasswordResetEmail(email, resetUrl)` via Resend. The same generic "check your inbox" response is returned regardless of whether the email exists.
4. The email's "Reset password" button links to `/reset-password?token=<token>`.
5. The user enters a new password, confirms it (≥8 chars + match).
6. Client: `authClient.resetPassword({ newPassword, token })`.
7. Server: validates the token (must exist, not expired), updates `account.password` (bcrypt), deletes the `verification` row, redirects to `/sign-in?reset=success`.
8. Sign-in page shows a success banner.

---

## 10) Sign-out

Triggered from the client:

```ts
import { signOut } from '@/lib/auth-client';

await signOut({
  fetchOptions: {
    onSuccess: () => { window.location.href = '/'; },
  },
});
```

What happens:
1. `POST /api/auth/sign-out` (via the better-auth client).
2. Server deletes the `session` row and clears the cookie.
3. Client browser drops the (now expired) cookie.
4. The next request has no session → middleware redirects protected routes to `/sign-in`.

Sign-out is offered from the navigation, the user menu, and (after delete-account) from `/settings`.

---

## 11) Roles & permissions

Single `users.role` field with three values:

| Role | Purpose |
|---|---|
| `member` | Default for everyone |
| `moderator` | Can moderate user-generated content / handle reports |
| `admin` | Full access — `/admin/*` routes, all admin actions |

Enforcement is **per-action**: server actions (and the admin layout) read `users.role` and either continue or throw `'Admin access required.'`.

Banning is independent: `requireAuth()` reads `users.banned` on every call and rejects banned users with `'Your account has been suspended.'`. Banning a user via `banUserAction(userId, reason?)` also deletes their existing sessions.

There's an `admin.adminAuditLog` table that tracks admin actions (who did what, when, against whom).

---

## 12) Account linking

Configured for Google as a trusted provider:

```ts
account: {
  accountLinking: {
    enabled: true,
    trustedProviders: ['google'],
  },
}
```

Practical effect: a user who originally signed up with Google can later add an email/password account, and vice versa. better-auth links them when the email matches.

---

## 13) Password change (settings page)

```ts
await authClient.changePassword({
  currentPassword,
  newPassword,
  revokeOtherSessions: false,
});
```

- Verifies the current password (bcrypt).
- Updates `account.password` (bcrypt-hashed).
- Optional: revoke other sessions (defaults to `false` — keeps the user logged in elsewhere).

---

## 14) Quick mental model

```
        SIGN UP                           SIGN IN
         │                                  │
         ▼                                  ▼
  email/password ─────►  better-auth  ◄───── email/password
         │                                  │
         ▼                                  ▼
  (optional) verify email              session cookie set
         │                                  │
         ▼                                  ▼
       /onboarding ──── done ────►       /home
                                         (gated by middleware:
                                          - session present
                                          - emailVerified (if enabled)
                                          - onboardingComplete)
```

---

## 15) Things to revisit in v2

- **Custom fields piling up on `users`** — `username`, `bio`, role, ban fields, all four Stripe columns. v2 could split this into `users` (auth identity), `user_profiles` (display fields), and `user_billing` (Stripe).
- **Single `role` enum** — works for now, but no granular permissions. v2 could move to a permission table or scoped roles per resource.
- **Two env vars for the same thing** (`REQUIRE_EMAIL_VERIFICATION` server-side and `NEXT_PUBLIC_REQUIRE_EMAIL_VERIFICATION` client-side) — easy to drift; consolidate via a single feature-flag system.
- **Middleware does both routing and rate limiting** — fine, but a lot of responsibility in one file. v2 could split rate limiting into an edge handler or per-route middleware.
- **Username availability check** is debounced client-side but not rate-limited — should be added to a search-style limiter in v2.
- **Onboarding is a 3-step required flow gated by middleware** — consider a "soft" onboarding that lets users explore Explore first, then complete profile incrementally.
