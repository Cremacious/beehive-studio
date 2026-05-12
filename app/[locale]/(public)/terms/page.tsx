export const metadata = { title: 'Terms of Service — Beehive Studio' }

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-[#141414]">
      <div className="max-w-3xl mx-auto px-6 py-16">
        <h1 className="text-3xl font-bold text-white mainFont mb-2">Terms of Service</h1>
        <p className="text-white/40 text-sm mb-12">Last updated: May 2026</p>
        <div className="space-y-8 text-white/70 leading-relaxed">
          <section>
            <h2 className="text-white font-semibold text-lg mb-3">Acceptance of Terms</h2>
            <p>By using Beehive Studio, you agree to these Terms of Service. If you do not agree, please do not use the service.</p>
          </section>
          <section>
            <h2 className="text-white font-semibold text-lg mb-3">Your Content</h2>
            <p>You retain full ownership of all writing, books, and content you create on Beehive Studio. By publishing content publicly, you grant other users the right to read it. We do not claim ownership of your work.</p>
          </section>
          <section>
            <h2 className="text-white font-semibold text-lg mb-3">Acceptable Use</h2>
            <p>You agree not to use Beehive Studio to distribute illegal content, harass other users, attempt to circumvent security measures, or violate any applicable laws.</p>
          </section>
          <section>
            <h2 className="text-white font-semibold text-lg mb-3">Premium Subscriptions</h2>
            <p>Premium subscriptions are billed monthly or annually. You may cancel at any time. Refunds are handled on a case-by-case basis — contact support@beehive-studio.app.</p>
          </section>
          <section>
            <h2 className="text-white font-semibold text-lg mb-3">Termination</h2>
            <p>We reserve the right to suspend or terminate accounts that violate these terms. You may delete your account at any time from your account settings.</p>
          </section>
          <section>
            <h2 className="text-white font-semibold text-lg mb-3">Contact</h2>
            <p>Questions? Email support@beehive-studio.app.</p>
          </section>
        </div>
      </div>
    </div>
  )
}
