# Error-handling audit — Routes, import/redeem/admin actions, third-party degradation (issue #46)

Read-only audit, 2026-06-25. Gold standard = `app/api/export/[bookId]/[format]/route.ts` + `app/api/chapter-save-beacon/route.ts`: auth check returns clean status, generation wrapped in try/catch returning clean JSON + 500, body JSON parse wrapped, never an unhandled throw.

### Summary

- **API routes** NEEDS-FIX: **0** (3 audited + 2 references — all at or above the bar).
- **Import + redeem + admin actions** NEEDS-FIX: **2**
  - `redeemPromoCodeAction` — `requireAuth()` and the pre-transaction read queries are unguarded (uncaught throw on auth failure or DB hiccup); only the write transaction is wrapped.
  - Admin mutations (`grant/revoke/setBanned/deleteUser`, `deleteContent`, `createPromoCode`/`setPromoActive`/`deletePromoCode`) — naked `db.update`/`db.delete`/`db.query` calls outside any try/catch. An unexpected DB error throws raw to the form action (no clean `{ ok:false }` returned). Lower severity (admin-only surface, redirect-guarded), but inconsistent with the bar.
- **Third-party degradation** NEEDS-FIX: **0** (all best-effort and non-blocking).

**Highest-risk gaps:**
1. `redeemPromoCodeAction` is a **user-facing** action where `await requireAuth()` (line 22) is not in a try/catch. On an unauthenticated/expired session it throws `AuthError` rather than returning `{ ok:false, error }`, surfacing as an unhandled action rejection. This is the only user-facing gap in this batch and is the top priority.
2. The seven admin mutations leave their core DB writes unguarded — an unexpected DB error escapes as an unhandled throw instead of `{ ok:false, error }`. Admin-only and behind a redirect guard, so risk is contained, but it diverges from the gold standard and should be normalized.

---

## API routes

| Name | File | try/catch | Status code correct | Status + note |
|---|---|---|---|---|
| `GET` export | `app/api/export/[bookId]/[format]/route.ts` | yes | yes (401/400/404/500) | **OK** (reference). Auth→401, bad format→400, not-owner→404, no chapters→400, generation in try/catch→500, EPUB metadata read has `.catch(()=>null)`. This is the bar. |
| `POST` beacon | `app/api/chapter-save-beacon/route.ts` | yes | yes (401/400/404/204/500) | **OK** (reference). Whole body wrapped; inner JSON parse wrapped (400); Zod safeParse (400); ownership→404; outer catch→500. |
| `GET/PATCH/PUT/DELETE/POST` auth | `app/api/auth/[...all]/route.ts` | partial | yes (429 on rate limit) | **OK**. Delegates to better-auth's `toNextJsHandler`, which owns its own error handling and returns proper auth responses; this is the framework boundary, not app code. Rate-limit checks return clean 429 JSON before delegating. `getClientIp` is pure/non-throwing. No app-level try/catch needed — better-auth is the trusted handler. |
| `POST` stripe webhook | `app/api/webhooks/stripe/route.ts` | yes | yes (400/500/200) | **OK**. Missing signature→400, missing secret→500, `constructEvent` in try/catch→400 with message, handler dispatch in try/catch→500 (intentional, so Stripe retries), unknown events logged + ignored→200. Meets/exceeds the bar. |

---

## Import + redeem + admin actions

| Name | File | try/catch | Status code correct (ActionResult shape) | Status + note |
|---|---|---|---|---|
| `parseImportAction` | `lib/import/import.actions.ts` | yes | yes | **OK**. `requireAuth` in try/catch → `UNAUTHORIZED`; premium gate → `PREMIUM_REQUIRED:import`; rate limit → friendly message; no-file → message; `validateDocumentFile` → message; parse block in try/catch distinguishing typed `ImportError` (`err.message`) from unexpected (logged + generic message). Typed ImportError + premium + rate-limit all returned gracefully. Gold-standard for an action. |
| `commitImportAction` | `lib/import/import.actions.ts` | partial (intentional) | yes | **OK**. `requireAuth`/`assertBookOwner` each wrapped → ActionResult; premium gate; overflow → `FREE_LIMIT_REACHED`; empty → message. The `db.transaction` (lines 158–198) is **not** wrapped, but transaction-level failure is the all-or-nothing guarantee and there's no partial-state risk; an unexpected DB error would throw rather than return ActionResult. Marginal — could mirror the export route's wrap-the-generation pattern, but no correctness or partial-write hazard. Treating as OK; optional hardening only. |
| `redeemPromoCodeAction` | `app/[locale]/(app)/redeem/actions.ts` | partial | partial | **NEEDS-FIX**: `await requireAuth()` (L22) + all pre-transaction reads (`promoCodes.findFirst`, `promoRedemptions.findFirst`, L27/L39) are unguarded. Auth failure throws `AuthError` (user-facing) instead of `{ ok:false }`; a DB read error also escapes uncaught. Only the write `db.transaction` is wrapped (L71–102). Validation branches all return clean `{ ok:false, error }`. Fix: guard `requireAuth` → `{ ok:false, error:'Please sign in.' }` and wrap reads. |
| `adminLoginAction` | `app/admin/login/actions.ts` | no (none thrown) | yes | **OK**. No DB; constant-time `safeCompare`; env-not-configured / missing fields / invalid creds each return clean `{ ok:false, error }`. `cookies().set` + `redirect` are control flow. No throwing surface. |
| `adminLogoutAction` | `app/admin/login/actions.ts` | no (none thrown) | n/a | **OK**. Cookie delete + best-effort log + redirect. No throwing surface. |
| `grantCompPremiumAction` | `app/admin/users/actions.ts` | no | partial | **NEEDS-FIX** (low): `requireAdmin` redirects on no-session (clean control flow), missing-userId returns `{ ok:false }`, but `db.query.userBilling.findFirst` + `db.update`/`db.insert` (L42–56) are naked. An unexpected DB error throws raw. Admin-only, redirect-guarded. Wrap the DB block → `{ ok:false, error }`. |
| `revokeCompPremiumAction` | `app/admin/users/actions.ts` | no | partial | **NEEDS-FIX** (low): naked `db.update` (L75). Same note as above. |
| `setBannedAction` | `app/admin/users/actions.ts` | no | partial | **NEEDS-FIX** (low): naked `db.update` (L98). Same note. |
| `deleteUserAction` | `app/admin/users/actions.ts` | no | partial | **NEEDS-FIX** (low): naked `db.delete` (L125, CASCADE). Same note; destructive, so a clean error return is more valuable here. |
| `deleteContentAction` | `app/admin/content/actions.ts` | no | partial | **NEEDS-FIX** (low): `requireAdmin` + missing-id + unknown-kind default all return cleanly, but each `db.delete` branch (L33–50) is naked. Same note. |
| `createPromoCodeAction` | `app/admin/promo-codes/actions.ts` | yes | yes | **OK**. `requireAdmin`; validates code/kind/maxUses → clean errors; `db.insert` in try/catch → `{ ok:false, error:'That code already exists.' }` (unique-violation). Meets the bar. |
| `setPromoActiveAction` | `app/admin/promo-codes/actions.ts` | no | partial | **NEEDS-FIX** (low): naked `db.update` (L66). Same admin-DB note. |
| `deletePromoCodeAction` | `app/admin/promo-codes/actions.ts` | no | partial | **NEEDS-FIX** (low): naked `db.delete` (L81). Same note. |
| `wipeDatabaseAction` | `app/admin/wipe/actions.ts` | yes | yes | **OK**. Prod-disabled guard; `requireAdmin`; confirmation check; Cloudinary cleanup best-effort (see below); `TRUNCATE` in try/catch → logs `db.wipe.failed` + returns `{ ok:false, error }`. Strong. |

> The 7 "NEEDS-FIX (low)" admin items are one shared fix: wrap each action's DB mutation in try/catch returning `{ ok:false, error }`, matching `createPromoCodeAction`/`wipeDatabaseAction` in the same area. All are admin-only and behind `requireAdmin` (redirect guard), so severity is low; the fix is consistency with the established bar.

---

## Third-party degradation

| Name | File | try/catch | Non-fatal / non-blocking | Status + note |
|---|---|---|---|---|
| `deleteCloudinaryImage` | `lib/cloudinary.ts` | no (by design) | yes | **OK**. Bare `cloudinary.uploader.destroy`; intentionally lets the *caller* decide. Every caller wraps it: `wipeCloudinaryAssets` loops each delete in try/catch (counts `failed`), export route's EPUB metadata uses `.catch`. Failure never blocks the user. |
| `getCloudinaryPublicId` | `lib/cloudinary.ts` | yes | yes | **OK**. Pure, regex match wrapped in try/catch → `null`. Whitelist filtering in wipe drops non-app URLs. Cannot throw. |
| `buildCloudinaryUrl` | `lib/cloudinary.ts` | no | n/a | **OK**. Throws only on missing `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME` (config error, fail-loud is correct); not in any audited route/action path here. |
| `wipeCloudinaryAssets` | `app/admin/wipe/actions.ts` | yes | yes | **OK**. Each `collect` query try/catch'd (missing column won't abort), each delete try/catch'd with `{deleted, failed}` counts. Runs BEFORE truncate and explicitly documented best-effort — a Cloudinary outage never blocks the DB wipe. Exemplary graceful degradation. |
| `logAdminAction` | `lib/admin/log-action.ts` | yes | yes | **OK**. Entire `db.insert` wrapped in try/catch → `console.warn`. A logging failure never breaks the originating admin write. Used by every admin mutation. |
| Upstash rate limiters (`importLimiter`, `signUpLimiter`, `signInLimiter`, `forgotPasswordLimiter`) | used in `lib/import/import.actions.ts`, `app/api/auth/[...all]/route.ts` | no (at call site) | partial | **OK**. `.limit()` results are read and gated cleanly (429 / friendly ActionResult). Calls are not individually try/catch'd, so an Upstash outage would throw — but this is consistent app-wide and not a regression introduced here; rate limiters are treated as available infrastructure. No fix required for issue #46 scope. |

No Resend / email-send usage is referenced by any file in this batch (grep for `resend|sendEmail|sendMail` over `**/*.ts` returned nothing in scope).
