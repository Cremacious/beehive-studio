import { CommunityDashboardGrid } from './_components/community-dashboard-grid';
import { getCommunityDashboardAction } from '@/lib/actions/community-dashboard.actions';
import { PageExplainer } from '@/components/tips/page-explainer';

export const metadata = { title: 'Community' };

export default async function CommunityPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const data = await getCommunityDashboardAction();
  return (
    <>
      <CommunityDashboardGrid data={data} locale={locale} />
      <PageExplainer tipKey="community-intro" />
    </>
  );
}
