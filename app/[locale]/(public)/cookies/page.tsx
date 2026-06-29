import { LegalPage, LegalSection } from '../_components/legal-page'

export const metadata = { title: 'Cookie Policy' }

export default function CookiesPage() {
  return (
    <LegalPage title="Cookie Policy" updated="Last updated: May 2026">
      <LegalSection heading="What Are Cookies">
        <p>
          Cookies are small text files stored on your device by your browser. We
          use them to keep you signed in and remember your preferences.
        </p>
      </LegalSection>

      <LegalSection heading="Cookies We Use">
        <p>
          <strong style={{ color: 'var(--canvas-dark-ink-strong)' }}>
            Authentication:
          </strong>{' '}
          A session cookie to keep you signed in. This is strictly necessary for
          the service to function.
        </p>
        <p>
          <strong style={{ color: 'var(--canvas-dark-ink-strong)' }}>
            Analytics:
          </strong>{' '}
          If you consent, we may use anonymised analytics cookies to understand
          how the app is used.
        </p>
        <p>
          <strong style={{ color: 'var(--canvas-dark-ink-strong)' }}>
            Advertising:
          </strong>{' '}
          Free-tier users see ads. Ad networks may set cookies on your device.
        </p>
      </LegalSection>

      <LegalSection heading="Managing Cookies">
        <p>
          You can disable non-essential cookies at any time through your browser
          settings or our cookie consent banner. Disabling strictly necessary
          cookies will prevent you from using the service.
        </p>
      </LegalSection>

      <LegalSection heading="Contact">
        <p>Questions? Email privacy@beehive-studio.app.</p>
      </LegalSection>
    </LegalPage>
  )
}
