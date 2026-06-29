import { LegalPage, LegalSection } from '../_components/legal-page'

export const metadata = { title: 'DMCA Policy' }

export default function DmcaPage() {
  return (
    <LegalPage title="DMCA Policy" updated="Last updated: May 2026">
      <LegalSection heading="Reporting Infringement">
        <p>
          If you believe content on Beehive Books infringes your copyright,
          please send a DMCA takedown notice to dmca@beehive-studio.app. Your
          notice must include:
        </p>
        <ul>
          <li>Your contact information</li>
          <li>Identification of the copyrighted work</li>
          <li>URL or description of the infringing content</li>
          <li>A statement of good faith belief</li>
          <li>Your electronic or physical signature</li>
        </ul>
      </LegalSection>

      <LegalSection heading="Counter-Notices">
        <p>
          If you believe content was removed incorrectly, you may submit a
          counter-notice to dmca@beehive-studio.app with the same contact
          information and a statement under penalty of perjury that the content
          was removed in error.
        </p>
      </LegalSection>

      <LegalSection heading="Repeat Infringers">
        <p>
          We will terminate accounts of users who repeatedly infringe copyrights
          in appropriate circumstances.
        </p>
      </LegalSection>
    </LegalPage>
  )
}
