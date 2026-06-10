'use client'

import { CoverPicker } from './cover-picker'
import {
  ExampleChips,
  HelperText,
  RECESSED_INPUT_STYLE,
  RECESSED_TEXTAREA_STYLE,
  WizardField,
  WizardFooter,
  recessBlur,
  recessFocus,
} from './wizard-field'

type Props = {
  title: string
  subtitle: string
  synopsis: string
  coverUrl: string | null
  onUpdate: (fields: Partial<{ title: string; subtitle: string; synopsis: string; coverUrl: string | null }>) => void
  onNext: () => void
  onCancel: () => void
  titleError: string | null
}

export function StepOne({ title, subtitle, synopsis, coverUrl, onUpdate, onNext, onCancel, titleError }: Props) {
  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: '22px' }}>
        <CoverPicker coverUrl={coverUrl} onChange={url => onUpdate({ coverUrl: url })} />

        <div className="flex flex-col gap-[18px]">
          <WizardField label="Title" required>
            <HelperText id="title-help">
              What&apos;s this book called? A working title is fine. You can change it any time.
              It&apos;ll appear on your bookshelf and at the top of every chapter.
            </HelperText>
            <input
              type="text"
              value={title}
              autoFocus
              aria-describedby="title-help"
              onChange={e => onUpdate({ title: e.target.value })}
              onFocus={recessFocus}
              onBlur={recessBlur}
              style={{
                ...RECESSED_INPUT_STYLE,
                ...(titleError ? { borderColor: 'oklch(0.62 0.21 25)' } : {}),
              }}
            />
            {titleError && (
              <p style={{ fontSize: 12, color: 'oklch(0.62 0.21 25)', marginTop: 4 }}>{titleError}</p>
            )}
            <ExampleChips
              examples={["'The Last Glassblower'", "'Tideborn'", "'Untitled Project'"]}
              onPick={value => onUpdate({ title: value.replace(/^'|'$/g, '') })}
              ariaLabelPrefix="Use title"
            />
          </WizardField>

          <WizardField label="Subtitle" optionalMarker="optional">
            <HelperText id="subtitle-help">
              Sometimes a subtitle tells the reader exactly what they&apos;re picking up:{' '}
              <strong>&apos;A Novel of the Saltwater Coast&apos;</strong>,{' '}
              <strong>&apos;Book One of the Lantern Cycle&apos;</strong>. Skip if not sure.
            </HelperText>
            <input
              type="text"
              value={subtitle}
              aria-describedby="subtitle-help"
              onChange={e => onUpdate({ subtitle: e.target.value })}
              onFocus={recessFocus}
              onBlur={recessBlur}
              style={RECESSED_INPUT_STYLE}
            />
          </WizardField>

          <WizardField label="Synopsis" optionalMarker="optional · up to 500 words">
            <HelperText id="synopsis-help">
              Two or three sentences. The back-of-the-book pitch. Even rough notes work;
              this is for you, and you can edit it later.
            </HelperText>
            <textarea
              value={synopsis}
              aria-describedby="synopsis-help"
              rows={5}
              maxLength={2000}
              onChange={e => onUpdate({ synopsis: e.target.value })}
              onFocus={recessFocus}
              onBlur={recessBlur}
              style={{
                ...RECESSED_TEXTAREA_STYLE,
                minHeight: 130,
                resize: 'vertical' as const,
                fontFamily: 'var(--font-prose)',
                fontSize: 15,
                lineHeight: 1.55,
              }}
            />
            <p style={{ fontSize: 11, color: 'var(--canvas-dark-ink-muted)', textAlign: 'right' as const, margin: 0 }}>
              {synopsis.length}/2000
            </p>
          </WizardField>
        </div>
      </div>

      <WizardFooter
        onCancel={onCancel}
        onNext={() => { if (!title.trim()) return; onNext() }}
        nextLabel="Next: tell us how to find it →"
        nextDisabled={!title.trim()}
      />
    </div>
  )
}
