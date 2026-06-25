/**
 * Maps a server-action error string to user-facing copy.
 *
 * Client surfaces should call this rather than dropping a raw code into a toast,
 * so messaging is consistent everywhere and internal codes never leak to users.
 *
 * Rules:
 *  - Known codes map to a friendly sentence.
 *  - `PREMIUM_REQUIRED:<feature>` maps to an upgrade prompt naming the feature.
 *  - A string that already reads like a human sentence (has spaces + lowercase)
 *    is passed through unchanged, so existing good messages survive.
 *  - Anything else falls back to a generic, reassuring message.
 *
 * No em-dashes anywhere (project copy rule).
 */

const KNOWN: Record<string, string> = {
  UNAUTHORIZED: 'Your session has expired. Please sign in again.',
  NOT_AUTHORIZED: 'Your session has expired. Please sign in again.',
  FORBIDDEN: "You don't have permission to do that.",
  NOT_ALLOWED: "You don't have permission to do that.",
  BLOCKED: 'This action is not available.',
  NOT_FOUND: "We couldn't find what you were looking for.",
  USER_NOT_FOUND: "We couldn't find that user.",
  BOOK_NOT_FOUND: "We couldn't find that book.",
  HIVE_NOT_FOUND: "We couldn't find that hive.",
  TOKEN_NOT_FOUND: 'That invite link is no longer valid.',
  TOKEN_EXPIRED: 'That invite link has expired.',
  TOKEN_ALREADY_CLAIMED: 'That invite link has already been used.',
  FREE_LIMIT_REACHED: "You've reached the free plan limit. Upgrade to Premium for more.",
  INVALID_INPUT: 'Please check your input and try again.',
  INVALID_CONTENT: 'Please check your input and try again.',
  INVALID_STATE: 'That action is not available right now.',
  INVALID_CURSOR: 'Something went wrong loading more. Please refresh.',
  TITLE_REQUIRED: 'A title is required.',
  WORD_LIMIT_EXCEEDED: 'Your entry is over the word limit.',
  MENTION_CAP_EXCEEDED: 'You have mentioned too many people. Please remove a few and try again.',
  RATE_LIMITED: "You're doing that too fast. Please wait a moment and try again.",
  FETCH_FAILED: "We couldn't load that right now. Please try again.",
  NETWORK_ERROR: 'Network problem. Please check your connection and try again.',
  INTERNAL_ERROR: 'Something went wrong on our end. Please try again.',
  UNKNOWN: 'Something went wrong. Please try again.',
  ALREADY_MEMBER: "You're already a member.",
  NOT_MEMBER: "You're not a member of this.",
  NOT_PENDING: 'That request is no longer pending.',
  SELF_INVITE: "You can't invite yourself.",
  SELF_MUTE: "You can't mute yourself.",
  LIKED_LIST_IMMUTABLE: "Your Liked list updates automatically and can't be edited.",
  REPLY_DEPTH_EXCEEDED: "You can't reply any deeper on this thread.",
  SPARK_NOT_OPEN: 'This Spark is not open for entries.',
  SPARK_STILL_OPEN: 'This Spark is still open.',
  SUBMISSION_LOCKED: 'This submission is locked.',
}

const PREMIUM_FEATURE_COPY: Record<string, string> = {
  version_history: 'Version history is a Premium feature. Upgrade to access it.',
  publishing_metadata: 'Publishing details are a Premium feature. Upgrade to access them.',
  book_import: 'Importing manuscripts is a Premium feature. Upgrade to access it.',
  import: 'Importing manuscripts is a Premium feature. Upgrade to access it.',
  writing_analysis: 'Writing analysis is a Premium feature. Upgrade to access it.',
}

export function errorToMessage(code: string | null | undefined): string {
  if (!code) return KNOWN.UNKNOWN

  if (code.startsWith('PREMIUM_REQUIRED:')) {
    const feature = code.slice('PREMIUM_REQUIRED:'.length)
    return PREMIUM_FEATURE_COPY[feature] ?? 'This is a Premium feature. Upgrade to access it.'
  }

  if (code in KNOWN) return KNOWN[code]

  // Already a human-readable sentence (existing actions return some of these):
  // has a space and at least one lowercase letter, and isn't an ALL_CAPS_CODE.
  if (/\s/.test(code) && /[a-z]/.test(code) && !/^[A-Z0-9_:]+$/.test(code)) {
    return code
  }

  return KNOWN.UNKNOWN
}
