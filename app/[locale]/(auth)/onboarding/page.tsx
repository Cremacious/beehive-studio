import { OnboardingFlow } from './_components/onboarding-flow'

export const metadata = { title: 'Get started · Beehive Books' }

export default async function OnboardingPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  return <OnboardingFlow locale={locale} />
}
