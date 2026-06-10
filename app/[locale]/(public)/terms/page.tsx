import { LegalPage, LegalSection } from '../_components/legal-page'

export const metadata = { title: 'Terms of Service · Beehive Studio' }

export default function TermsPage() {
  return (
    <LegalPage title="Terms of Service" updated="Last updated: May 2026">
      <LegalSection heading="Acceptance of Terms">
        <p>
          By using Beehive Studio, you agree to these Terms of Service. If you
          do not agree, please do not use the service.
        </p>
      </LegalSection>

      <LegalSection heading="Your Content">
        <p>
          You retain full ownership of all writing, books, and content you
          create on Beehive Studio. By publishing content publicly, you grant
          other users the right to read it. We do not claim ownership of your
          work.
        </p>
      </LegalSection>

      <LegalSection heading="Acceptable Use">
        <p>
          You agree not to use Beehive Studio to distribute illegal content,
          harass other users, attempt to circumvent security measures, or
          violate any applicable laws.
        </p>
      </LegalSection>

      <LegalSection heading="Premium Subscriptions">
        <p>
          Premium subscriptions are billed monthly or annually. You may cancel
          at any time. Refunds are handled on a case-by-case basis. Contact
          support@beehive-studio.app.
        </p>
      </LegalSection>

      <LegalSection heading="Termination">
        <p>
          We reserve the right to suspend or terminate accounts that violate
          these terms. You may delete your account at any time from your account
          settings.
        </p>
      </LegalSection>

      <LegalSection heading="Contact">
        <p>Questions? Email support@beehive-studio.app.</p>
      </LegalSection>
    </LegalPage>
  )
}
