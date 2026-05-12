export const metadata = { title: 'DMCA Policy — Beehive Studio' }

export default function DmcaPage() {
  return (
    <div className="min-h-screen bg-[#141414]">
      <div className="max-w-3xl mx-auto px-6 py-16">
        <h1 className="text-3xl font-bold text-white mainFont mb-2">DMCA Policy</h1>
        <p className="text-white/40 text-sm mb-12">Last updated: May 2026</p>
        <div className="space-y-8 text-white/70 leading-relaxed">
          <section>
            <h2 className="text-white font-semibold text-lg mb-3">Reporting Infringement</h2>
            <p>If you believe content on Beehive Studio infringes your copyright, please send a DMCA takedown notice to dmca@beehive-studio.app. Your notice must include:</p>
            <ul className="list-disc list-inside mt-2 space-y-1">
              <li>Your contact information</li>
              <li>Identification of the copyrighted work</li>
              <li>URL or description of the infringing content</li>
              <li>A statement of good faith belief</li>
              <li>Your electronic or physical signature</li>
            </ul>
          </section>
          <section>
            <h2 className="text-white font-semibold text-lg mb-3">Counter-Notices</h2>
            <p>If you believe content was removed incorrectly, you may submit a counter-notice to dmca@beehive-studio.app with the same contact information and a statement under penalty of perjury that the content was removed in error.</p>
          </section>
          <section>
            <h2 className="text-white font-semibold text-lg mb-3">Repeat Infringers</h2>
            <p>We will terminate accounts of users who repeatedly infringe copyrights in appropriate circumstances.</p>
          </section>
        </div>
      </div>
    </div>
  )
}
