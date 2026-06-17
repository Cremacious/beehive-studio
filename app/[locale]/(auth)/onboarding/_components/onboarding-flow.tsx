'use client'

import { useState, useRef } from 'react'
import Link from 'next/link'
import { checkUsernameAvailableAction, completeOnboardingAction } from '@/lib/actions/onboarding.actions'
import { MentionableTextarea } from '@/components/mentions/mentionable-textarea'

type Step = 1 | 2 | 3
type UsernameStatus = 'idle' | 'checking' | 'valid' | 'error'

const panelStyle: React.CSSProperties = {
  background: 'linear-gradient(180deg, var(--canvas-dark-250), var(--canvas-dark-200))',
  borderRadius: 'var(--r-card)',
  boxShadow: 'var(--sh-card)',
  border: 'var(--br-card)',
  color: 'var(--canvas-dark-ink-strong, #fff)',
}

const inputStyle: React.CSSProperties = {
  background: 'var(--canvas-dark-100)',
  boxShadow: 'var(--sh-inset)',
  borderRadius: 'var(--r-row)',
  color: 'var(--canvas-dark-ink-strong, #fff)',
  border: '1px solid transparent',
}

const tileStyle: React.CSSProperties = {
  background: 'linear-gradient(180deg, var(--canvas-dark-350), var(--canvas-dark-300))',
  boxShadow: 'var(--sh-tile)',
  borderRadius: 'var(--r-row)',
  border: 'var(--br-card)',
  color: 'var(--canvas-dark-ink-strong, #fff)',
}

const ctaStyle: React.CSSProperties = {
  background: 'var(--brand)',
  color: 'var(--brand-ink)',
  borderRadius: 'var(--r-pill)',
}

const fieldClass =
  'w-full px-4 py-3.5 text-[15px] placeholder:opacity-40 focus:outline-none focus:ring-[3px] focus:ring-[oklch(from_var(--brand)_l_c_h_/_0.18)] transition-all'

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className ?? 'w-4 h-4'} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 6 9 17l-5-5"/>
    </svg>
  )
}

function SpinnerIcon() {
  return (
    <svg className="w-5 h-5 animate-spin" style={{ color: 'var(--canvas-dark-ink-muted)' }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <path d="M12 2v4" opacity="1"/><path d="M12 18v4" opacity=".3"/><path d="m4.93 4.93 2.83 2.83" opacity=".7"/>
      <path d="m16.24 16.24 2.83 2.83" opacity=".2"/><path d="M2 12h4" opacity=".5"/><path d="M18 12h4" opacity=".1"/>
      <path d="m4.93 19.07 2.83-2.83" opacity=".4"/><path d="m16.24 7.76 2.83-2.83" opacity=".6"/>
    </svg>
  )
}

function ProgressBar({
  step,
  maxReached,
  onJump,
}: {
  step: Step
  maxReached: Step
  onJump: (n: Step) => void
}) {
  function Chip({ n, label }: { n: Step; label: string }) {
    const isActive = n === step
    const isDone = n < step
    const clickable = !isActive && n <= maxReached

    const chipStyle: React.CSSProperties = isActive
      ? {
          background: 'var(--brand)',
          color: 'var(--brand-ink)',
          boxShadow:
            '0 0 0 3px oklch(from var(--brand) l c h / 0.22), var(--sh-tile)',
        }
      : {
          background:
            'linear-gradient(180deg, var(--canvas-dark-350), var(--canvas-dark-300))',
          color: isDone || clickable
            ? 'var(--canvas-dark-ink)'
            : 'var(--canvas-dark-ink-muted)',
          boxShadow: 'var(--sh-tile)',
        }

    const numStyle: React.CSSProperties = isActive
      ? { background: 'var(--brand-ink)', color: 'var(--brand)' }
      : isDone || clickable
        ? {
            background: 'oklch(from var(--brand) l c h / 0.18)',
            color: 'var(--brand)',
          }
        : { background: 'var(--canvas-dark-100)', color: 'var(--canvas-dark-ink-muted)' }

    return (
      <button
        type="button"
        onClick={clickable ? () => onJump(n) : undefined}
        disabled={!clickable}
        aria-current={isActive ? 'step' : undefined}
        aria-label={
          isActive
            ? `${label} (current step)`
            : clickable
              ? `Go back to ${label}`
              : label
        }
        className={[
          'inline-flex items-center gap-2 px-3 py-1.5 text-[12px] mainFont whitespace-nowrap transition-all',
          isActive ? 'font-bold' : isDone ? 'font-semibold' : 'font-medium',
          clickable ? 'cursor-pointer hover:brightness-110' : 'cursor-default',
          'disabled:cursor-default focus:outline-none focus-visible:ring-2 focus-visible:ring-[oklch(from_var(--brand)_l_c_h_/_0.6)]',
        ].join(' ')}
        style={{ ...chipStyle, borderRadius: 'var(--r-pill)' }}
      >
        <span
          className="inline-flex items-center justify-center w-5 h-5 rounded-full text-[11px] font-bold"
          style={numStyle}
        >
          {isDone ? <CheckIcon className="w-3 h-3" /> : n}
        </span>
        <span>{label}</span>
      </button>
    )
  }

  function Connector({ done }: { done: boolean }) {
    return (
      <div
        aria-hidden="true"
        className="flex-1 h-[1.5px] rounded-full mx-1.5 min-w-2 transition-colors"
        style={{
          background: done ? 'var(--brand)' : 'var(--canvas-dark-300)',
        }}
      />
    )
  }

  return (
    <nav
      aria-label="Onboarding steps"
      className="flex items-center mb-6"
    >
      <Chip n={1} label="Username" />
      <Connector done={step > 1} />
      <Chip n={2} label="Profile" />
      <Connector done={step > 2} />
      <Chip n={3} label="Photo" />
    </nav>
  )
}

export function OnboardingFlow({ locale }: { locale: string }) {
  const [step, setStep] = useState<Step>(1)
  // Tracks the highest step the user has advanced THROUGH (so done-pills stay
  // clickable after the user jumps back to an earlier step).
  const [maxReached, setMaxReached] = useState<Step>(1)

  function goToStep(target: Step) {
    setStep(target)
    setMaxReached((prev) => (target > prev ? target : prev) as Step)
  }

  function goBack() {
    if (step === 2) setStep(1)
    else if (step === 3) setStep(2)
  }

  // Step 1
  const [username, setUsername] = useState('')
  const [usernameStatus, setUsernameStatus] = useState<UsernameStatus>('idle')
  const [usernameFeedback, setUsernameFeedback] = useState('')
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Step 2
  const [bio, setBio] = useState('')

  // Step 3
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Submit
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  function handleUsernameInput(val: string) {
    setUsername(val)
    if (debounceRef.current) clearTimeout(debounceRef.current)

    if (!val) {
      setUsernameStatus('idle')
      setUsernameFeedback('')
      return
    }
    if (/[^a-zA-Z0-9_]/.test(val)) {
      setUsernameStatus('error')
      setUsernameFeedback('Only letters, numbers, and underscores allowed.')
      return
    }
    if (val.length < 3) {
      setUsernameStatus('error')
      setUsernameFeedback('Must be at least 3 characters.')
      return
    }

    setUsernameStatus('checking')
    setUsernameFeedback('Checking availability…')

    const captured = val
    debounceRef.current = setTimeout(async () => {
      const result = await checkUsernameAvailableAction(captured)
      if (result.error) {
        setUsernameStatus('error')
        setUsernameFeedback(result.error)
      } else if (result.available) {
        setUsernameStatus('valid')
        setUsernameFeedback(`@${captured} is available!`)
      } else {
        setUsernameStatus('error')
        setUsernameFeedback(`@${captured} is already taken.`)
      }
    }, 600)
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => setAvatarPreview(ev.target?.result as string)
    reader.readAsDataURL(file)
  }

  function removeAvatar() {
    setAvatarPreview(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  async function handleFinish() {
    setSubmitting(true)
    setSubmitError(null)
    const result = await completeOnboardingAction({
      username,
      bio: bio || undefined,
    })
    if (!result.success) {
      setSubmitError(result.error ?? 'Something went wrong.')
      setSubmitting(false)
    } else {
      window.location.href = `/${locale}/studio`
    }
  }

  const usernameStatusBorder =
    usernameStatus === 'valid'
      ? '1px solid oklch(0.72 0.16 145 / 0.55)'
      : usernameStatus === 'error'
        ? '1px solid oklch(0.62 0.18 25 / 0.55)'
        : '1px solid transparent'

  const usernameInputStyle: React.CSSProperties = {
    ...inputStyle,
    border: usernameStatusBorder,
  }

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ background: '#262728', color: 'var(--canvas-dark-ink-strong, #fff)' }}
    >
      {/* Header */}
      <header className="relative z-10">
        <div className="max-w-7xl mx-auto px-6 lg:px-8 h-16 flex items-center">
          <Link href={`/${locale}`} className="flex items-center gap-2.5">
            <span
              className="mainFont font-bold text-[17px] tracking-tight"
              style={{ color: 'var(--brand)' }}
            >
              Beehive Studio
            </span>
          </Link>
        </div>
      </header>

      {/* Main */}
      <main className="relative z-10 flex-1 flex items-center justify-center px-6 py-10">
        <div className="w-full max-w-[440px]">
          <ProgressBar step={step} maxReached={maxReached} onJump={(n) => setStep(n)} />

          <div className="p-8 sm:p-10" style={panelStyle}>

            {/* ── Step 1: Username ─────────────────────────── */}
            {step === 1 && (
              <div>
                <div className="mb-7">
                  <h1 className="mainFont font-bold text-[22px] leading-tight" style={{ color: 'var(--brand)' }}>
                    Choose your username
                  </h1>
                  <p className="text-[14.5px] mt-2.5 leading-relaxed" style={{ color: 'var(--canvas-dark-ink-muted)' }}>
                    This is how other writers will find you.
                  </p>
                </div>

                <form onSubmit={e => { e.preventDefault(); goToStep(2) }} className="space-y-4">
                  <div>
                    <label
                      htmlFor="username"
                      className="block text-[12px] font-mono uppercase tracking-wider mb-1.5"
                      style={{ color: 'var(--canvas-dark-ink-muted)' }}
                    >
                      Username
                    </label>
                    <div className="relative">
                      <span
                        className="absolute left-4 top-1/2 -translate-y-1/2 text-[15px] select-none pointer-events-none"
                        style={{ color: 'var(--canvas-dark-ink-muted)' }}
                      >
                        @
                      </span>
                      <input
                        id="username"
                        type="text"
                        autoComplete="username"
                        spellCheck={false}
                        autoCapitalize="off"
                        maxLength={20}
                        placeholder="mayavance"
                        value={username}
                        onChange={e => handleUsernameInput(e.target.value)}
                        className={`${fieldClass} pl-9 pr-11`}
                        style={usernameInputStyle}
                      />
                      <div className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center">
                        {usernameStatus === 'checking' && <SpinnerIcon />}
                        {usernameStatus === 'valid' && (
                          <svg className="w-5 h-5" style={{ color: 'oklch(0.72 0.16 145)' }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M20 6 9 17l-5-5"/>
                          </svg>
                        )}
                        {usernameStatus === 'error' && (
                          <svg className="w-5 h-5" style={{ color: 'oklch(0.72 0.16 25)' }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M18 6 6 18"/><path d="m6 6 12 12"/>
                          </svg>
                        )}
                      </div>
                    </div>
                    <div className="mt-2 text-[12.5px] leading-snug min-h-[18px]">
                      {usernameStatus === 'checking' && <span style={{ color: 'var(--canvas-dark-ink-muted)' }}>{usernameFeedback}</span>}
                      {usernameStatus === 'valid' && <span style={{ color: 'oklch(0.72 0.16 145)' }}>{usernameFeedback}</span>}
                      {usernameStatus === 'error' && <span style={{ color: 'oklch(0.72 0.16 25)' }}>{usernameFeedback}</span>}
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={usernameStatus !== 'valid'}
                    className="mainFont font-bold w-full px-5 py-3.5 text-[15px] inline-flex items-center justify-center gap-2 mt-2 hover:-translate-y-px disabled:opacity-35 disabled:cursor-not-allowed disabled:transform-none transition-all"
                    style={ctaStyle}
                  >
                    Continue
                    <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>
                    </svg>
                  </button>
                </form>

                <p className="text-[12px] mt-5 leading-relaxed text-center" style={{ color: 'var(--canvas-dark-ink-muted)' }}>
                  3–20 characters. Letters, numbers, underscores only.
                </p>
              </div>
            )}

            {/* ── Step 2: Bio ──────────────────────────────── */}
            {step === 2 && (
              <div>
                <div className="mb-7">
                  <h1 className="mainFont font-bold text-[22px] leading-tight" style={{ color: 'var(--brand)' }}>
                    Tell us about yourself
                  </h1>
                  <p className="text-[14.5px] mt-2.5 leading-relaxed" style={{ color: 'var(--canvas-dark-ink-muted)' }}>
                    Optional. You can always add this later.
                  </p>
                </div>

                <div className="space-y-4">
                  <div>
                    <label
                      htmlFor="bio"
                      className="block text-[12px] font-mono uppercase tracking-wider mb-1.5"
                      style={{ color: 'var(--canvas-dark-ink-muted)' }}
                    >
                      Bio
                    </label>
                    <MentionableTextarea
                      id="bio"
                      maxLength={200}
                      rows={4}
                      placeholder="Novelist, night owl, tea enthusiast. Writing my first thriller set in coastal Cornwall."
                      value={bio}
                      onChange={setBio}
                      className={`${fieldClass} resize-none`}
                      style={inputStyle}
                    />
                    <div className="flex items-center justify-end mt-1.5">
                      <span
                        className="text-[12px] tabular-nums"
                        style={{ color: bio.length >= 180 ? 'var(--brand)' : 'var(--canvas-dark-ink-muted)' }}
                      >
                        {bio.length} / 200
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between mt-2">
                    <button
                      type="button"
                      onClick={goBack}
                      className="mainFont inline-flex items-center gap-1.5 px-2 py-2 text-[13.5px] font-medium hover:text-[var(--brand)] transition-colors"
                      style={{ color: 'var(--canvas-dark-ink-muted)' }}
                      aria-label="Back to username"
                    >
                      <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="m12 19-7-7 7-7"/><path d="M19 12H5"/>
                      </svg>
                      Back
                    </button>
                    <button
                      type="button"
                      onClick={() => goToStep(3)}
                      className="mainFont font-bold px-6 py-3.5 text-[15px] inline-flex items-center justify-center gap-2 hover:-translate-y-px transition-all"
                      style={ctaStyle}
                    >
                      Continue
                      <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* ── Step 3: Avatar ───────────────────────────── */}
            {step === 3 && (
              <div>
                <div className="mb-7">
                  <h1 className="mainFont font-bold text-[22px] leading-tight" style={{ color: 'var(--brand)' }}>
                    Add a profile photo
                  </h1>
                  <p className="text-[14.5px] mt-2.5 leading-relaxed" style={{ color: 'var(--canvas-dark-ink-muted)' }}>
                    Optional.
                  </p>
                </div>

                <div className="flex flex-col items-center mb-8">
                  <div
                    role="button"
                    tabIndex={0}
                    aria-label="Upload profile photo"
                    onClick={() => fileInputRef.current?.click()}
                    onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileInputRef.current?.click() } }}
                    className="w-[140px] h-[140px] rounded-full relative overflow-hidden cursor-pointer transition-all group hover:-translate-y-px"
                    style={
                      avatarPreview
                        ? { border: '2px solid oklch(from var(--brand) l c h / 0.4)' }
                        : { ...tileStyle, borderRadius: '999px', border: '2px dashed oklch(1 0 0 / 0.12)' }
                    }
                  >
                    {avatarPreview ? (
                      <>
                        <img src={avatarPreview} alt="Profile photo preview" className="w-full h-full object-cover rounded-full" />
                        <div className="absolute inset-0 rounded-full bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <svg viewBox="0 0 24 24" className="w-6 h-6 text-white" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                            <circle cx="12" cy="13" r="4"/>
                          </svg>
                        </div>
                      </>
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center gap-2">
                        <svg viewBox="0 0 24 24" className="w-10 h-10" style={{ color: 'oklch(from var(--brand) l c h / 0.5)' }} fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                          <circle cx="12" cy="13" r="4"/>
                        </svg>
                      </div>
                    )}
                  </div>

                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleFileChange}
                  />

                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="text-[13px] mt-4 hover:underline hover:underline-offset-4 transition-colors bg-transparent border-0"
                    style={{ color: 'var(--brand)' }}
                  >
                    {avatarPreview ? 'Change photo' : 'Click to upload'}
                  </button>

                  {avatarPreview && (
                    <button
                      type="button"
                      onClick={removeAvatar}
                      className="text-[12px] mt-1.5 hover:opacity-80 transition-colors"
                      style={{ color: 'var(--canvas-dark-ink-muted)' }}
                    >
                      Remove photo
                    </button>
                  )}
                </div>

                {submitError && (
                  <p
                    className="text-[13px] rounded-xl px-4 py-3 mb-4"
                    style={{
                      color: 'oklch(0.72 0.16 25)',
                      background: 'oklch(0.62 0.18 25 / 0.10)',
                      border: '1px solid oklch(0.62 0.18 25 / 0.25)',
                    }}
                  >
                    {submitError}
                  </p>
                )}

                <div className="flex items-center justify-between">
                  <button
                    type="button"
                    onClick={goBack}
                    disabled={submitting}
                    className="mainFont inline-flex items-center gap-1.5 px-2 py-2 text-[13.5px] font-medium hover:text-[var(--brand)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    style={{ color: 'var(--canvas-dark-ink-muted)' }}
                    aria-label="Back to profile"
                  >
                    <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="m12 19-7-7 7-7"/><path d="M19 12H5"/>
                    </svg>
                    Back
                  </button>
                  <button
                    type="button"
                    onClick={handleFinish}
                    disabled={submitting || usernameStatus !== 'valid'}
                    title={usernameStatus !== 'valid' ? 'Pick a valid username on step 1 first' : undefined}
                    className="mainFont font-bold px-6 py-3.5 text-[15px] inline-flex items-center justify-center gap-2 hover:-translate-y-px disabled:opacity-40 disabled:cursor-not-allowed disabled:transform-none transition-all"
                    style={ctaStyle}
                  >
                    {submitting ? 'Setting up…' : 'Finish setup'}
                    {!submitting && (
                      <CheckIcon className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>
            )}

          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 py-6">
        <div
          className="max-w-7xl mx-auto px-6 lg:px-8 flex flex-wrap items-center justify-between gap-3 text-[12px]"
          style={{ color: 'var(--canvas-dark-ink-muted)' }}
        >
          <div>© 2026 Beehive Studio</div>
          <div className="flex items-center gap-5">
            <Link href={`/${locale}/privacy`} className="hover:opacity-80 transition-opacity">Privacy</Link>
            <Link href={`/${locale}/terms`} className="hover:opacity-80 transition-opacity">Terms</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
