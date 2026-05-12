export const metadata = { title: 'Cookie Policy — Beehive Studio' }

export default function CookiesPage() {
  return (
    <div className="min-h-screen bg-[#141414]">
      <div className="max-w-3xl mx-auto px-6 py-16">
        <h1 className="text-3xl font-bold text-white mainFont mb-2">Cookie Policy</h1>
        <p className="text-white/40 text-sm mb-12">Last updated: May 2026</p>
        <div className="space-y-8 text-white/70 leading-relaxed">
          <section>
            <h2 className="text-white font-semibold text-lg mb-3">What Are Cookies</h2>
            <p>Cookies are small text files stored on your device by your browser. We use them to keep you signed in and remember your preferences.</p>
          </section>
          <section>
            <h2 className="text-white font-semibold text-lg mb-3">Cookies We Use</h2>
            <p><strong className="text-white">Authentication:</strong> A session cookie to keep you signed in. This is strictly necessary for the service to function.</p>
            <p className="mt-2"><strong className="text-white">Analytics:</strong> If you consent, we may use anonymised analytics cookies to understand how the app is used.</p>
            <p className="mt-2"><strong className="text-white">Advertising:</strong> Free-tier users see ads. Ad networks may set cookies on your device.</p>
          </section>
          <section>
            <h2 className="text-white font-semibold text-lg mb-3">Managing Cookies</h2>
            <p>You can disable non-essential cookies at any time through your browser settings or our cookie consent banner. Disabling strictly necessary cookies will prevent you from using the service.</p>
          </section>
          <section>
            <h2 className="text-white font-semibold text-lg mb-3">Contact</h2>
            <p>Questions? Email privacy@beehive-studio.app.</p>
          </section>
        </div>
      </div>
    </div>
  )
}
