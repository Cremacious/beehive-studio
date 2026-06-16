// lib/actions/community-dashboard.shared.ts
// NOT a 'use server' file — exports types + constants for cross-import.

export type HeroKind =
  | 'NEW_CHAPTER_FROM_FOLLOWED'
  | 'FRIEND_SPARK_WIN'
  | 'FRIEND_NEW_BOOK'
  | 'FRIEND_JOINED_HIVE_WITH_VIEWER'
  | 'TODAYS_SPARK'
  | 'FEATURED_DISCOVERABLE_BOOK';

export type HeroSignal = {
  kind: HeroKind;
  label: string;              // "★ FRESH FROM A FRIEND" etc.
  metaInline: string;         // "2h ago · ♥ 24 · 💬 6"
  headline: string;
  quote: string | null;
  coverUrl: string | null;    // null when kind === 'TODAYS_SPARK' → glyph fallback rendered client-side
  coverAuthor: string | null; // shown in cover footer
  coverTitle: string | null;  // shown in cover header
  primaryCta: { label: string; href: string };
  secondaryCta: { label: string; href: string } | null;
};

export type PulseStat = {
  value: number;              // -1 sentinel = render "—" placeholder
  delta: string;              // "↑ 12%" or "↑ 3 today" or "2h since"
  deltaTone: 'green' | 'dim';
  sparkline: number[];        // 7 elements, oldest first; all-zero array on empty
  hint: string | null;        // helper text (empty state); when set num grays out
};

export type PulseStats = {
  words: PulseStat;
  followers: PulseStat;
  reads: PulseStat & { chapterNumber: number | null };
  engagement: PulseStat;
};

export type PillTone = 'brand' | 'mono' | 'green' | 'blue' | 'purple';

export type RowLeading =
  | { kind: 'avatar'; avatarUrl: string | null; fallbackInitial: string }
  | { kind: 'icon'; glyph: string; tone: PillTone }
  | { kind: 'cover-stack'; covers: { coverUrl: string | null; title: string }[] }
  | { kind: 'cover'; coverUrl: string | null; fallbackInitial: string };

export type PanelRow = {
  id: string;
  leading: RowLeading;
  t1: string;                 // may contain **bold** markers parsed client-side
  t2: string;
  trailingPill: { label: string; tone: PillTone } | null;
  href: string;
};

export type MidPanelData = {
  label: string;              // "🐝 HIVES · 3 ACTIVE"
  seeAllHref: string;
  rows: PanelRow[];           // length <= 3
  isEmpty: boolean;           // when true, rows = nudge rows
};

export type FriendsDeskData = {
  label: string;
  seeAllHref: string;
  rows: PanelRow[];           // first page ~4-6 rows
  nextCursor: string | null;
  isEmpty: boolean;
};

export type DashboardFallbacks = {
  todaysSpark: { id: string; prompt: string; wordLimit: number | null; entriesCount: number; deadlineLabel: string } | null;
  trendingHive: { id: string; name: string; memberCount: number } | null;
  votingSpark: { id: string; title: string; entriesCount: number } | null;
  trendingList: { id: string; title: string; covers: { coverUrl: string | null; title: string }[] } | null;
  topClubs: { id: string; name: string; bookTitle: string | null; coverUrl: string | null; memberCount: number }[];
  openHivesCount: number;
  openClubsCount: number;
};

export type CommunityDashboardData = {
  hero: HeroSignal | null;
  pulse: PulseStats;
  hives: MidPanelData;
  sparks: MidPanelData;
  lists: MidPanelData;
  friends: FriendsDeskData;
  clubs: MidPanelData;
  fallbacks: DashboardFallbacks;
};

export const EMPTY_PULSE: PulseStats = {
  words: { value: -1, delta: '', deltaTone: 'dim', sparkline: [0,0,0,0,0,0,0], hint: 'Start a book to begin tracking' },
  followers: { value: 0, delta: '', deltaTone: 'dim', sparkline: [0,0,0,0,0,0,0], hint: 'Publish a chapter to start' },
  reads: { value: -1, delta: '', deltaTone: 'dim', sparkline: [0,0,0,0,0,0,0], hint: 'No published chapter yet', chapterNumber: null },
  engagement: { value: 0, delta: '', deltaTone: 'dim', sparkline: [0,0,0,0,0,0,0], hint: 'Share work to receive feedback' },
};

export const EMPTY_DASHBOARD: CommunityDashboardData = {
  hero: null,
  pulse: EMPTY_PULSE,
  hives:  { label: '🐝 HIVES',  seeAllHref: '/hives',         rows: [], isEmpty: true },
  sparks: { label: '✨ SPARKS', seeAllHref: '/sparks',        rows: [], isEmpty: true },
  lists:  { label: '📚 LISTS',  seeAllHref: '/reading-lists', rows: [], isEmpty: true },
  friends:{ label: 'FRIENDS\' DESKS · CHRONOLOGICAL', seeAllHref: '/community/feed', rows: [], nextCursor: null, isEmpty: true },
  clubs:  { label: '📖 CLUBS',  seeAllHref: '/clubs',         rows: [], isEmpty: true },
  fallbacks: {
    todaysSpark: null, trendingHive: null, votingSpark: null, trendingList: null,
    topClubs: [], openHivesCount: 0, openClubsCount: 0,
  },
};
