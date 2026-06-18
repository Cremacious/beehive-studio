import { SettingsNav } from './_components/settings-nav'

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        maxWidth: '960px',
        margin: '0 auto',
        padding: '28px 24px 96px',
        display: 'grid',
        gridTemplateColumns: '180px 1fr',
        gap: '40px',
        alignItems: 'start',
      }}
    >
      {/* Sidebar */}
      <aside style={{ position: 'sticky', top: '88px' }}>
        <SettingsNav />
      </aside>

      {/* Page content */}
      <div className="min-w-0">
        {children}
      </div>
    </div>
  )
}
