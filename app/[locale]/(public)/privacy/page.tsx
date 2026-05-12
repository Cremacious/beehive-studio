import Link from 'next/link'
import { headers } from 'next/headers'
import { auth } from '@/lib/auth'

export const metadata = { title: 'Privacy Policy — Beehive Studio' }

export default async function PrivacyPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  const session = await auth.api.getSession({ headers: await headers() }).catch(() => null)
  const user = session?.user

  const navItemBase = 'relative px-3.5 py-1.5 rounded-full text-[14px] font-medium transition-colors text-white/55 hover:text-white hover:bg-white/5'

  return (
    <div className="min-h-screen flex flex-col bg-[#141414]">

      {/* Nav */}
      <header className="sticky top-0 z-40 bg-[#141414]/90 backdrop-blur border-b border-border/70">
        <div className="max-w-7xl mx-auto px-5 lg:px-8 h-14 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Link href={`/${locale}`} className="flex items-center gap-2.5 shrink-0">
              <span className="relative inline-flex items-center justify-center w-8 h-8 rounded-[10px] bg-brand/15 border border-brand/30">
                <svg viewBox="0 0 24 24" className="w-[18px] h-[18px]" fill="none" stroke="#FFC300" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2 L20 6.5 L20 15.5 L12 20 L4 15.5 L4 6.5 Z"/>
                  <path d="M12 9 L16 11 L16 14.5 L12 16.5 L8 14.5 L8 11 Z" fill="#FFC300" fillOpacity="0.6" stroke="none"/>
                </svg>
              </span>
              <span className="mainFont font-bold text-[15px] tracking-tight hidden sm:inline">Beehive</span>
            </Link>
            <nav className="flex items-center gap-1">
              <Link href={`/${locale}/studio`} className={navItemBase}>
                <span className="flex items-center gap-2">
                  <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
                  </svg>
                  Studio
                </span>
              </Link>
              <Link href={`/${locale}/community`} className={navItemBase}>
                <span className="flex items-center gap-2">
                  <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 2 L20 6.5 L20 15.5 L12 20 L4 15.5 L4 6.5 Z"/>
                    <path d="M12 7 L16 9.5 L16 13.5 L12 16 L8 13.5 L8 9.5 Z"/>
                  </svg>
                  Community
                </span>
              </Link>
              <Link href={`/${locale}/discover`} className={navItemBase}>
                <span className="flex items-center gap-2">
                  <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>
                  </svg>
                  Discover
                </span>
              </Link>
            </nav>
          </div>

          <div className="flex items-center gap-1.5">
            {user ? (
              <>
                <button className="w-10 h-10 rounded-xl inline-flex items-center justify-center text-white/55 hover:text-white hover:bg-white/[0.06] transition-colors relative" aria-label="Notifications">
                  <svg viewBox="0 0 24 24" className="w-[18px] h-[18px]" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/>
                    <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>
                  </svg>
                </button>
                <button className="w-8 h-8 rounded-full bg-brand/20 border border-brand/30 flex items-center justify-center text-[12px] font-bold text-brand mainFont ml-1" aria-label="Account menu">
                  {(user.name?.[0] ?? user.email?.[0] ?? 'U').toUpperCase()}
                </button>
              </>
            ) : (
              <Link href={`/${locale}/sign-in`} className="text-[13.5px] font-medium text-white/60 hover:text-white transition-colors px-3 py-1.5">
                Sign in
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1">
        <div className="max-w-2xl mx-auto px-6 lg:px-8 py-14 lg:py-20">

          <div className="mb-10">
            <Link href={`/${locale}`} className="inline-flex items-center gap-2 text-[13px] text-white/50 hover:text-white transition-colors mb-5 group">
              <svg viewBox="0 0 24 24" className="w-4 h-4 transition-transform group-hover:-translate-x-0.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 12H5"/><path d="m12 19-7-7 7-7"/>
              </svg>
              Back to home
            </Link>
            <h1 className="mainFont font-bold text-[32px] sm:text-[38px] leading-tight tracking-tight">Privacy Policy</h1>
            <p className="text-white/40 text-[14px] mt-3">Last updated: May 11, 2026</p>
          </div>

          <div className="space-y-0">
            <Section title="1. Introduction">
              <p>Beehive Studio ("we", "us", or "our") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our web application and related services (the "Service").</p>
              <p>By accessing or using the Service, you agree to this Privacy Policy. If you do not agree with the terms of this policy, please do not use the Service.</p>
            </Section>

            <Section title="2. Information we collect">
              <p>We collect information you provide directly and information collected automatically when you use the Service.</p>
              <p><strong>Information you provide:</strong></p>
              <ul>
                <li>Account details — name, email address, username, and profile photo</li>
                <li>Content — manuscripts, chapters, notes, comments, and other writing you create or upload</li>
                <li>Communications — messages you send to other users through Hive collaboration or support requests</li>
                <li>Payment information — billing details processed by our third-party payment provider (we do not store full card numbers)</li>
              </ul>
              <p><strong>Information collected automatically:</strong></p>
              <ul>
                <li>Device and browser type, operating system, and IP address</li>
                <li>Usage data — pages viewed, features used, session duration, and interaction patterns</li>
                <li>Cookies and similar technologies for authentication, preferences, and analytics</li>
              </ul>
            </Section>

            <Section title="3. How we use your information">
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
            </Section>

            <Section title="4. Sharing your information">
              <p>We do not sell your personal information. We may share your information in the following circumstances:</p>
              <ul>
                <li><strong>With your consent</strong> — when you choose to publish content on Discover or share manuscripts through Hive</li>
                <li><strong>Service providers</strong> — trusted third parties who assist us in operating the Service (hosting, analytics, payment processing), bound by confidentiality obligations</li>
                <li><strong>Legal requirements</strong> — when required by law, regulation, or legal process</li>
                <li><strong>Business transfers</strong> — in connection with a merger, acquisition, or sale of assets, with prior notice to you</li>
              </ul>
            </Section>

            <Section title="5. Your content and manuscripts">
              <p>Your writing is yours. We do not claim ownership of any content you create on Beehive Studio. We access your manuscripts only to provide the Service (rendering, syncing, collaboration) and to comply with legal obligations.</p>
              <p>Content you publish on Discover is visible to other users according to your publication settings. Unpublished drafts remain private to you and any collaborators you explicitly invite.</p>
            </Section>

            <Section title="6. Data retention">
              <p>We retain your account information and content for as long as your account is active. If you delete your account, we will delete or anonymize your personal data within 30 days, except where retention is required by law or for legitimate business purposes (e.g., resolving disputes).</p>
              <p>You can export your manuscripts at any time in EPUB, PDF, or DOCX format from the Studio.</p>
            </Section>

            <Section title="7. Security">
              <p>We implement industry-standard security measures including encryption in transit (TLS), encryption at rest, and regular security audits. However, no method of electronic transmission or storage is 100% secure, and we cannot guarantee absolute security.</p>
            </Section>

            <Section title="8. Cookies">
              <p>We use essential cookies for authentication and session management, and optional analytics cookies to understand how the Service is used. You can manage cookie preferences in your browser settings. Disabling essential cookies may affect your ability to use the Service.</p>
            </Section>

            <Section title="9. Your rights">
              <p>Depending on your location, you may have the following rights:</p>
              <ul>
                <li><strong>Access</strong> — request a copy of the personal data we hold about you</li>
                <li><strong>Correction</strong> — request that we correct inaccurate or incomplete data</li>
                <li><strong>Deletion</strong> — request that we delete your personal data</li>
                <li><strong>Portability</strong> — request your data in a structured, machine-readable format</li>
                <li><strong>Objection</strong> — object to processing based on legitimate interests</li>
              </ul>
              <p>To exercise any of these rights, contact us at <a href="mailto:privacy@beehivestudio.com" className="text-brand hover:underline underline-offset-4">privacy@beehivestudio.com</a>.</p>
            </Section>

            <Section title="10. Children's privacy">
              <p>The Service is not intended for users under 16 years of age. We do not knowingly collect personal information from children under 16. If we learn that we have collected data from a child under 16, we will take steps to delete it promptly.</p>
            </Section>

            <Section title="11. Changes to this policy">
              <p>We may update this Privacy Policy from time to time. We will notify you of material changes by posting the updated policy on this page and updating the "Last updated" date. Your continued use of the Service after changes constitutes acceptance of the revised policy.</p>
            </Section>

            <Section title="12. Contact us">
              <p>If you have questions about this Privacy Policy or our data practices, please contact us:</p>
              <ul>
                <li>Email: <a href="mailto:privacy@beehivestudio.com" className="text-brand hover:underline underline-offset-4">privacy@beehivestudio.com</a></li>
              </ul>
            </Section>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border/70 bg-[#121212]">
        <div className="max-w-7xl mx-auto px-6 lg:px-8 py-8 flex flex-wrap items-center justify-between gap-3 text-[12px] text-white/40">
          <div>© 2026 Beehive Studio</div>
          <div className="flex items-center gap-5">
            <Link href={`/${locale}/privacy`} className="text-brand hover:underline underline-offset-4">Privacy</Link>
            <Link href={`/${locale}/terms`} className="hover:text-white/70 transition-colors">Terms</Link>
            <Link href={`/${locale}/dmca`} className="hover:text-white/70 transition-colors">DMCA</Link>
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
              All systems honey
            </span>
          </div>
        </div>
      </footer>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const isFirst = title.startsWith('1.')
  return (
    <div className={`${isFirst ? '' : 'pt-6 mt-6 border-t border-border'}`}>
      <h2 className="mainFont font-bold text-[20px] text-white mb-3">{title}</h2>
      <div className="prose-bh space-y-3 text-white/65 text-[15px] leading-[1.75] [&_strong]:text-white/85 [&_strong]:font-semibold [&_a]:text-brand [&_a:hover]:underline [&_a]:underline-offset-4">
        {children}
      </div>
    </div>
  )
}
