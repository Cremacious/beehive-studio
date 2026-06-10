import { LegalPage, LegalSection } from '../_components/legal-page'

export const metadata = { title: 'Privacy Policy · Beehive Studio' }

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy" updated="Last updated: May 11, 2026">
      <LegalSection heading="1. Introduction">
        <p>
          Beehive Studio (&quot;we&quot;, &quot;us&quot;, or &quot;our&quot;) is committed to protecting
          your privacy. This Privacy Policy explains how we collect, use,
          disclose, and safeguard your information when you use our web
          application and related services (the &quot;Service&quot;).
        </p>
        <p>
          By accessing or using the Service, you agree to this Privacy Policy.
          If you do not agree with the terms of this policy, please do not use
          the Service.
        </p>
      </LegalSection>

      <LegalSection heading="2. Information we collect">
        <p>
          We collect information you provide directly and information collected
          automatically when you use the Service.
        </p>
        <p>
          <strong>Information you provide:</strong>
        </p>
        <ul>
          <li>Account details: name, email address, username, and profile photo</li>
          <li>Content: manuscripts, chapters, notes, comments, and other writing you create or upload</li>
          <li>Communications: messages you send to other users through Hive collaboration or support requests</li>
          <li>Payment information: billing details processed by our third-party payment provider (we do not store full card numbers)</li>
        </ul>
        <p>
          <strong>Information collected automatically:</strong>
        </p>
        <ul>
          <li>Device and browser type, operating system, and IP address</li>
          <li>Usage data: pages viewed, features used, session duration, and interaction patterns</li>
          <li>Cookies and similar technologies for authentication, preferences, and analytics</li>
        </ul>
      </LegalSection>

      <LegalSection heading="3. How we use your information">
        <p>We use the information we collect to:</p>
        <ul>
          <li>Provide, maintain, and improve the Service</li>
          <li>Create and manage your account</li>
          <li>Process transactions and send related notifications</li>
          <li>Enable collaboration features (Hive) and community interactions (Discover)</li>
          <li>Send you updates, security alerts, and support messages</li>
          <li>Analyze usage trends to improve the writing experience</li>
          <li>Detect, prevent, and address technical issues or abuse</li>
        </ul>
      </LegalSection>

      <LegalSection heading="4. Sharing your information">
        <p>
          We do not sell your personal information. We may share your information
          in the following circumstances:
        </p>
        <ul>
          <li><strong>With your consent:</strong> when you choose to publish content on Discover or share manuscripts through Hive</li>
          <li><strong>Service providers:</strong> trusted third parties who assist us in operating the Service (hosting, analytics, payment processing), bound by confidentiality obligations</li>
          <li><strong>Legal requirements:</strong> when required by law, regulation, or legal process</li>
          <li><strong>Business transfers:</strong> in connection with a merger, acquisition, or sale of assets, with prior notice to you</li>
        </ul>
      </LegalSection>

      <LegalSection heading="5. Your content and manuscripts">
        <p>
          Your writing is yours. We do not claim ownership of any content you
          create on Beehive Studio. We access your manuscripts only to provide
          the Service (rendering, syncing, collaboration) and to comply with
          legal obligations.
        </p>
        <p>
          Content you publish on Discover is visible to other users according to
          your publication settings. Unpublished drafts remain private to you
          and any collaborators you explicitly invite.
        </p>
      </LegalSection>

      <LegalSection heading="6. Data retention">
        <p>
          We retain your account information and content for as long as your
          account is active. If you delete your account, we will delete or
          anonymize your personal data within 30 days, except where retention is
          required by law or for legitimate business purposes (e.g., resolving
          disputes).
        </p>
        <p>
          You can export your manuscripts at any time in EPUB, PDF, or DOCX
          format from the Studio.
        </p>
      </LegalSection>

      <LegalSection heading="7. Security">
        <p>
          We implement industry-standard security measures including encryption
          in transit (TLS), encryption at rest, and regular security audits.
          However, no method of electronic transmission or storage is 100%
          secure, and we cannot guarantee absolute security.
        </p>
      </LegalSection>

      <LegalSection heading="8. Cookies">
        <p>
          We use essential cookies for authentication and session management,
          and optional analytics cookies to understand how the Service is used.
          You can manage cookie preferences in your browser settings. Disabling
          essential cookies may affect your ability to use the Service.
        </p>
      </LegalSection>

      <LegalSection heading="9. Your rights">
        <p>Depending on your location, you may have the following rights:</p>
        <ul>
          <li><strong>Access:</strong> request a copy of the personal data we hold about you</li>
          <li><strong>Correction:</strong> request that we correct inaccurate or incomplete data</li>
          <li><strong>Deletion:</strong> request that we delete your personal data</li>
          <li><strong>Portability:</strong> request your data in a structured, machine-readable format</li>
          <li><strong>Objection:</strong> object to processing based on legitimate interests</li>
        </ul>
        <p>
          To exercise any of these rights, contact us at{' '}
          <a href="mailto:privacy@beehivestudio.com">privacy@beehivestudio.com</a>.
        </p>
      </LegalSection>

      <LegalSection heading="10. Children's privacy">
        <p>
          The Service is not intended for users under 16 years of age. We do not
          knowingly collect personal information from children under 16. If we
          learn that we have collected data from a child under 16, we will take
          steps to delete it promptly.
        </p>
      </LegalSection>

      <LegalSection heading="11. Changes to this policy">
        <p>
          We may update this Privacy Policy from time to time. We will notify
          you of material changes by posting the updated policy on this page and
          updating the &quot;Last updated&quot; date. Your continued use of the Service
          after changes constitutes acceptance of the revised policy.
        </p>
      </LegalSection>

      <LegalSection heading="12. Contact us">
        <p>
          If you have questions about this Privacy Policy or our data practices,
          please contact us:
        </p>
        <ul>
          <li>
            Email:{' '}
            <a href="mailto:privacy@beehivestudio.com">privacy@beehivestudio.com</a>
          </li>
        </ul>
      </LegalSection>
    </LegalPage>
  )
}
