// lib/upgrade/feature-registry.ts
import {
  BookOpen,
  History,
  BookMarked,
  Users,
  Lock,
  Upload,
  BarChart3,
  Headphones,
  type LucideIcon,
} from 'lucide-react'

/** One key per in-app premium gate. */
export type GateKey =
  | 'book-limit'
  | 'version-history'
  | 'publishing'
  | 'hive-members'
  | 'overflow'
  | 'import'
  | 'writing-analysis'

type FeatureCopy = {
  /** Headline shown in the modal for this specific gate. */
  title: string
  /** One-line benefit shown on the inline pill / modal subheading. No em-dashes. */
  benefit: string
  icon: LucideIcon
}

export const FEATURE_COPY: Record<GateKey, FeatureCopy> = {
  'book-limit': {
    title: 'Write unlimited books',
    benefit: 'Your free tier holds 3 books. Premium removes the cap.',
    icon: BookOpen,
  },
  'version-history': {
    title: 'Never lose a draft',
    benefit: 'Premium saves chapter snapshots so you can restore any version.',
    icon: History,
  },
  publishing: {
    title: 'Publish like a pro',
    benefit: 'Add series, ISBN, and publishing notes with Premium.',
    icon: BookMarked,
  },
  'hive-members': {
    title: 'Grow your hive',
    benefit: 'Free hives hold 5 members. Premium makes them unlimited.',
    icon: Users,
  },
  overflow: {
    title: 'Unlock all your books',
    benefit: 'Premium keeps every book editable, not just your first 3.',
    icon: Lock,
  },
  import: {
    title: 'Bring your manuscript',
    benefit: 'Import DOCX, PDF, and EPUB into editable chapters with Premium.',
    icon: Upload,
  },
  'writing-analysis': {
    title: 'Sharpen every chapter',
    benefit: 'Premium unlocks readability, pacing, and style analysis.',
    icon: BarChart3,
  },
}

/** Ordered benefit list for the modal + pricing page. Lead 3 first. */
export const PREMIUM_BENEFITS: Array<{ title: string; description: string; icon: LucideIcon }> = [
  { title: 'Unlimited books', description: 'Write as many books as you want.', icon: BookOpen },
  { title: 'Version history', description: 'Snapshot and restore any chapter draft.', icon: History },
  { title: 'Unlimited hive members', description: 'Invite your whole writing circle.', icon: Users },
  { title: 'Publishing metadata', description: 'Series, ISBN, and publishing notes.', icon: BookMarked },
  { title: 'Book import', description: 'Bring in DOCX, PDF, and EPUB manuscripts.', icon: Upload },
  { title: 'Writing analysis', description: 'Readability, pacing, and style insights.', icon: BarChart3 },
  { title: 'Priority support', description: 'Faster help when you need it.', icon: Headphones },
]

/** Subtle forward-looking line for the pricing page. No overpromising. */
export const FUTURE_NOTE = 'AI writing tools are on the way for Premium members.'
