// The /community/* routes (sparks and their detail/entry pages) live in the
// (public) route group but are gated by middleware: an anonymous request is
// redirected to sign-in, so a crawler never reaches real content. They are
// therefore marked noindex and excluded from the sitemap (issue #52). Authed
// users still get good page titles from each page's own metadata.
export const metadata = { robots: { index: false, follow: false } }

export default function CommunityPublicLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <>{children}</>
}
