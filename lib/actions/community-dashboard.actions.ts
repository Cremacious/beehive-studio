'use server';

import { cache } from 'react';
import { getOptionalUserId } from '@/lib/require-auth';
import {
  resolveHeroSignal,
  getViewerPulseStats,
  getHivesPanelRows,
  getSparksPanelRows,
  getListsPanelRows,
  getClubsPanelRows,
  getFriendsDeskRows,
  loadDashboardFallbacks,
} from './community-dashboard.helpers';
import { EMPTY_DASHBOARD, EMPTY_PULSE } from './community-dashboard.shared';
import type { CommunityDashboardData, PanelRow } from './community-dashboard.shared';
import { cachedAction } from '@/lib/cache';

// Issue #37: the dashboard is the heaviest per-page aggregator (8 sub-aggregators,
// ~20 queries) and was only deduped within a request (React cache). It's a
// feed/overview, so a short cross-request TTL is invisible. CommunityDashboardData
// is fully JSON-safe (timestamps pre-formatted to strings, cursor is a string) so
// it round-trips cleanly through Upstash. No write-path invalidation needed at 45s.
const DASHBOARD_TTL_SECONDS = 45;

async function safe<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    console.error('[community-dashboard] sub-query failed:', e);
    return fallback;
  }
}

const computeDashboardData = async (viewerId: string): Promise<CommunityDashboardData> => {
  const [hero, pulse, hivesRows, sparksRows, listsRows, friends, clubsRows, fallbacks] = await Promise.all([
    safe(() => resolveHeroSignal(viewerId), null),
    safe(() => getViewerPulseStats(viewerId), EMPTY_PULSE),
    safe(() => getHivesPanelRows(viewerId), [] as PanelRow[]),
    safe(() => getSparksPanelRows(viewerId), [] as PanelRow[]),
    safe(() => getListsPanelRows(viewerId), [] as PanelRow[]),
    safe(() => getFriendsDeskRows(viewerId, 6), { rows: [] as PanelRow[], nextCursor: null }),
    safe(() => getClubsPanelRows(viewerId), [] as PanelRow[]),
    safe(() => loadDashboardFallbacks(viewerId), EMPTY_DASHBOARD.fallbacks),
  ]);
  return {
    hero,
    pulse,
    hives:  { label: `🐝 HIVES${hivesRows.length > 0 ? ` · ${hivesRows.length} ACTIVE` : ''}`, seeAllHref: '/community/hives',         rows: hivesRows,  isEmpty: hivesRows.length === 0 },
    sparks: { label: `✨ SPARKS · LIVE NOW`,                                                   seeAllHref: '/community/sparks',        rows: sparksRows, isEmpty: sparksRows.length === 0 },
    lists:  { label: `📚 LISTS · TRENDING`,                                                    seeAllHref: '/community/reading-lists', rows: listsRows,  isEmpty: listsRows.length === 0 },
    friends:{ label: `FRIENDS' DESKS · CHRONOLOGICAL`, seeAllHref: '/community/feed', rows: friends.rows, nextCursor: friends.nextCursor, isEmpty: friends.rows.length === 0 },
    clubs:  { label: `📖 CLUBS · YOU'RE IN`,                                                   seeAllHref: '/community/clubs',         rows: clubsRows,  isEmpty: clubsRows.length === 0 },
    fallbacks,
  };
};

// React cache() dedupes within a request; cachedAction adds a short cross-request
// Upstash TTL keyed per viewer.
const buildDashboardData = cache((viewerId: string): Promise<CommunityDashboardData> =>
  cachedAction(`dashboard:v1:${viewerId}`, () => computeDashboardData(viewerId), DASHBOARD_TTL_SECONDS),
);

export async function getCommunityDashboardAction(): Promise<CommunityDashboardData> {
  const viewerId = await getOptionalUserId();
  if (!viewerId) return EMPTY_DASHBOARD;
  return buildDashboardData(viewerId);
}

export async function getFriendsDeskNextPageAction(cursor: string): Promise<{ rows: PanelRow[]; nextCursor: string | null }> {
  const viewerId = await getOptionalUserId();
  if (!viewerId) return { rows: [], nextCursor: null };
  return safe(() => getFriendsDeskRows(viewerId, 10, cursor), { rows: [], nextCursor: null });
}
