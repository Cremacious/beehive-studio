'use client'

import { useRef, useState } from 'react'
import { PanelLeft, PanelRight, X } from 'lucide-react'
import { BinderTree } from './binder/binder-tree'
import { CorkboardOrEditor } from './corkboard-or-editor'
import { RightPanelSlot } from './right-panel-slot'
import { ResizeHandle } from './resize-handle'
import { useBookEditor } from './book-editor-provider'
import { PageExplainer } from '@/components/tips/page-explainer'
import { CoachMark } from '@/components/tips/coach-mark'
import { useDismissedTips } from '@/lib/tips/use-dismissed-tips'
import { useIsMobile } from '@/lib/hooks/use-is-mobile'

// Client shell composing the three studio columns + the two drag handles
// between them. Handles + column widths are wired to the editor provider's
// resizable panel state (issue #36).
export function StudioShell() {
  const { binderPanel, metadataPanel, focusMode } = useBookEditor()
  const isMobile = useIsMobile()
  // Mobile drawer state (issue #50). Independent of the desktop collapse state
  // so it never writes to the shared localStorage collapse keys.
  const [mobileDrawer, setMobileDrawer] = useState<null | 'binder' | 'meta'>(null)

  const binderHidden = focusMode || binderPanel.collapsed
  const metadataHidden = focusMode || metadataPanel.collapsed

  // Anchor for the panel-resize coach mark (issue #44).
  const leftHandleRef = useRef<HTMLDivElement>(null)

  // Queue tips one-per-surface: the resize coach mark waits until the editor
  // intro explainer is dismissed so two popups never stack on first visit.
  const { hydrated, isDismissed } = useDismissedTips()
  const resizeTipEnabled = hydrated && isDismissed('editor-intro') && !binderHidden

  // ── Mobile layout (issue #50) ────────────────────────────────────────
  // Full-width editor canvas with the binder + metadata panels as slide-in
  // overlay drawers. Pinned between the top nav (56px) and bottom tab bar
  // (56px). The desktop branch below is unchanged.
  if (isMobile) {
    const drawerTop = 'calc(56px + env(safe-area-inset-top))'
    const drawerBottom = 'calc(56px + env(safe-area-inset-bottom))'
    // Drawer cards sit a touch below the nav so the card edge reads clearly.
    const drawerCardTop = 'calc(56px + env(safe-area-inset-top) + 8px)'
    return (
      <div
        className="fixed inset-x-0 overflow-hidden"
        style={{ top: drawerTop, bottom: drawerBottom }}
      >
        <div className="h-full w-full flex flex-col overflow-hidden">
          <CorkboardOrEditor />
        </div>

        {/* Edge-tab triggers */}
        {!focusMode && mobileDrawer === null && (
          <>
            <button
              type="button"
              onClick={() => setMobileDrawer('binder')}
              aria-label="Open binder"
              className="absolute left-0 top-1/2 -translate-y-1/2 z-30 inline-flex items-center justify-center w-7 h-14 rounded-r-[var(--r-btn)]"
              style={{
                background: 'linear-gradient(180deg, var(--canvas-dark-350), var(--canvas-dark-300))',
                boxShadow: 'var(--sh-tile)',
                color: 'var(--brand)',
              }}
            >
              <PanelLeft size={16} />
            </button>
            <button
              type="button"
              onClick={() => setMobileDrawer('meta')}
              aria-label="Open chapter details"
              className="absolute right-0 top-1/2 -translate-y-1/2 z-30 inline-flex items-center justify-center w-7 h-14 rounded-l-[var(--r-btn)]"
              style={{
                background: 'linear-gradient(180deg, var(--canvas-dark-350), var(--canvas-dark-300))',
                boxShadow: 'var(--sh-tile)',
                color: 'var(--brand)',
              }}
            >
              <PanelRight size={16} />
            </button>
          </>
        )}

        {/* Backdrop */}
        {mobileDrawer !== null && (
          <button
            type="button"
            aria-label="Close panel"
            onClick={() => setMobileDrawer(null)}
            className="fixed inset-0 z-40 cursor-default"
            style={{ background: 'oklch(0 0 0 / 0.5)' }}
          />
        )}

        {/* Binder drawer (left). The wrapper IS the card: dark gradient surface
            with the close X integrated into its top bar; BinderTree renders
            transparent so it reads as a single seamless panel. */}
        <div
          className="fixed left-0 z-50 w-[86vw] max-w-[320px] pl-2 transition-transform duration-200 ease-out"
          style={{
            top: drawerCardTop,
            bottom: drawerBottom,
            transform: mobileDrawer === 'binder' ? 'translateX(0)' : 'translateX(-110%)',
          }}
        >
          <div
            className="h-full flex flex-col overflow-hidden"
            style={{
              background: 'linear-gradient(180deg, var(--canvas-dark-250), var(--canvas-dark-200))',
              borderRadius: 'var(--r-card)',
              boxShadow: 'var(--sh-card)',
              border: 'var(--br-card)',
            }}
          >
            <div className="flex items-center justify-end px-2 pt-2 pb-1 shrink-0">
              <DrawerClose onClick={() => setMobileDrawer(null)} />
            </div>
            <div className="flex-1 min-h-0 overflow-hidden">
              <BinderTree mobile />
            </div>
          </div>
        </div>

        {/* Metadata / history drawer (right). Wrapper uses the editor page bg so
            the status + metadata cards sit on it exactly like the desktop right
            column; the close X is integrated into its top bar. */}
        <div
          className="fixed right-0 z-50 w-[86vw] max-w-[340px] pr-2 transition-transform duration-200 ease-out"
          style={{
            top: drawerCardTop,
            bottom: drawerBottom,
            transform: mobileDrawer === 'meta' ? 'translateX(0)' : 'translateX(110%)',
          }}
        >
          <div
            className="h-full flex flex-col overflow-hidden"
            style={{
              background: 'var(--canvas-dark-100)',
              borderRadius: 'var(--r-card)',
              boxShadow: 'var(--sh-card)',
              border: 'var(--br-card)',
            }}
          >
            <div className="flex items-center justify-start px-2 pt-2 pb-1 shrink-0">
              <DrawerClose onClick={() => setMobileDrawer(null)} />
            </div>
            <div className="flex-1 min-h-0 overflow-hidden px-2 pb-2">
              <RightPanelSlot mobile />
            </div>
          </div>
        </div>

        <PageExplainer tipKey="editor-intro" />
      </div>
    )
  }

  return (
    /* The (app) layout uses min-h-screen (not h-screen), so h-full on a
       flex-1 ancestor resolves to content-height — not viewport. Pin the
       studio columns to viewport-minus-nav (h-14 = 56px) so the binder /
       editor / metadata fill the screen instead of stopping ~80% down. */
    /* Capped at the `max` width tier (issue #49) so the editor stays
       flush-bleed up to 1920px then centers on ultrawide instead of
       sprawling across a 32" monitor. No side gutters here by design —
       the binder reads better anchored near the edge. */
    <div
      className="mx-auto w-full flex gap-2 h-[calc(100vh-68px)] overflow-hidden"
      style={{ maxWidth: 'var(--page-w-max)' }}
    >
      <BinderTree />
      {!binderHidden && (
        <ResizeHandle
          ref={leftHandleRef}
          side="left"
          isDragging={binderPanel.isDragging}
          onPointerDown={binderPanel.startDrag}
          ariaLabel="Resize binder panel"
        />
      )}
      <CorkboardOrEditor />
      {!metadataHidden && (
        <ResizeHandle
          side="right"
          isDragging={metadataPanel.isDragging}
          onPointerDown={metadataPanel.startDrag}
          ariaLabel="Resize metadata panel"
        />
      )}
      <RightPanelSlot />

      {/* First-visit guidance for new writers. */}
      <PageExplainer tipKey="editor-intro" />
      <CoachMark
        tipKey="editor-resize-panels"
        anchorRef={leftHandleRef}
        placement="right"
        enabled={resizeTipEnabled}
      />
    </div>
  )
}

// Mobile drawer close affordance (issue #50). Rendered in the drawer's header
// strip (not overlapping content) as a visible tile chip.
function DrawerClose({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Close panel"
      className="inline-flex items-center justify-center w-9 h-9 rounded-full"
      style={{
        background: 'linear-gradient(180deg, var(--canvas-dark-350), var(--canvas-dark-300))',
        boxShadow: 'var(--sh-tile)',
        color: 'var(--canvas-dark-ink)',
      }}
    >
      <X size={18} />
    </button>
  )
}
