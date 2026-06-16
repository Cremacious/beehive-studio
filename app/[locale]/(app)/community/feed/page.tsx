import { getCommunityDashboardAction } from '@/lib/actions/community-dashboard.actions';
import { ActivityFeedFull } from './_components/activity-feed-full';

export default async function CommunityFeedPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const data = await getCommunityDashboardAction();
  return (
    <ActivityFeedFull
      initialRows={data.friends.rows}
      initialCursor={data.friends.nextCursor}
      locale={locale}
    />
  );
}
