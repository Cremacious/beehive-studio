# Error-handling audit + hardening — Issue #46

**Date:** 2026-06-25 · **Goal:** before public testing, no user action produces an unhandled crash, white screen, raw Next error overlay, or silent no-op. Every failure path recovers or shows a clear branded message.

This index synthesizes the five section audits and is the master checklist that drives the fix waves.

## Section files
- [01-actions-studio.md](./01-actions-studio.md) — book / binder / chapter / snapshot / publishing / reading / library / account / settings / onboarding / avatar / cloudinary-cleanup
- [02-actions-hive.md](./02-actions-hive.md) — all `hive*` action files
- [03-actions-community.md](./03-actions-community.md) — community / social / friendships / blocks / mutes / notifications / sparks / clubs / reading-lists / discover
- [04-routes-and-misc.md](./04-routes-and-misc.md) — API routes + import + redeem + admin actions + third-party degradation
- [05-client-surfaces.md](./05-client-surfaces.md) — every client component that calls a server action

## Headline findings

| Layer | Audited | NEEDS-FIX | Root cause |
|---|---|---|---|
| Studio actions | 31 | 28 | No try/catch around body; `requireAuth`/`assert*` throw raw |
| Hive actions | 56 | 33 | Same; some catch `requireHiveMember` locally but still leak leading `requireAuth` + tx throws |
| Community actions | ~135 (70 mut) | ~70 mut | Same; read-only fetchers that throw are OK-if-server-only |
| API routes | 4 | 0 | Already at bar (export route is the model) |
| Import/redeem/admin | 13 | 2 + 7 admin | `redeemPromoCodeAction` leading `requireAuth`; admin mutations unguarded (low risk) |
| Third-party (Cloudinary/Resend/Upstash) | — | 0 | Cloudinary deletes already best-effort; no Resend in scope |
| Client surfaces | ~140 sites | ~50 | Studio save surface silent-fails (no toast/rollback); destructive admin no feedback |
| Boundaries | error.tsx, not-found.tsx exist | upgrade + add | No `global-error.tsx`; existing fallbacks unbranded + leak raw error text |

## Canonical error-code vocabulary (the taxonomy)

Server actions return one of these as the `error` string; the client mapper translates to copy. Human-readable sentences from existing actions are preserved (the mapper passes them through).

- `UNAUTHORIZED` — no/expired session (AuthError 401)
- `FORBIDDEN` — banned, not owner, lacks permission (AuthError 403, assert\* throws)
- `NOT_FOUND`
- `FREE_LIMIT_REACHED`
- `PREMIUM_REQUIRED:<feature>`
- `INVALID_INPUT` — Zod / validation
- `RATE_LIMITED`
- `INTERNAL_ERROR` — catch-all for unexpected throws (logged server-side, generic copy client-side)
- `NETWORK_ERROR` — client-only, action transport threw (e.g. offline)

## Fix waves

- **Wave 1 — foundation + server actions.** Add `lib/actions/safe-action.ts` (`toActionError(err)` mapping AuthError/PREMIUM/assert throws → typed code + logs unexpected). Wrap mutation action bodies so thrown sentinels become `{ success:false, error }`. Fix the partial-write risks with transactions. Read-only `get*` fetchers used only in server components may keep throwing (page error boundary covers them) but are noted.
- **Wave 2 — API routes + misc actions.** `redeemPromoCodeAction` + admin mutations brought to bar. (Core routes already pass.)
- **Wave 3 — client surfaces.** Adopt `lib/errors/messages.ts` (`errorToMessage(code)`); every mutation call site checks `result.success`, shows `toast.error(errorToMessage(...))`, rolls back optimistic state, disables submit while pending. Shared editor-save helper fixes the ~18 `updateBinderItemAction` sites at once.
- **Wave 4 — boundaries.** Branded dark-iOS `app/[locale]/error.tsx` (no raw leak to users, keep console.error for devs), new `app/global-error.tsx`, branded `not-found.tsx` (both levels). Optional `loading.tsx` for jank.
- **Wave 5 — taxonomy adoption + third-party degradation.** Ensure the mapper is used everywhere; confirm non-essential third-party failures never block core actions.

## Verification gates
- `npx tsc --noEmit` clean
- `npm test` green
- Manual: expired session on gated action, free user hitting premium gate, oversized/malformed import file, forced action throw (becomes toast not crash), forced render throw (branded boundary not white screen).
