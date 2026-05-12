'use client'

import { useState, useRef } from 'react'
import Link from 'next/link'
import { checkUsernameAvailableAction, completeOnboardingAction } from '@/lib/actions/onboarding.actions'

type Step = 1 | 2 | 3
type UsernameStatus = 'idle' | 'checking' | 'valid' | 'error'

const fieldClass =
  'w-full bg-[#252525] border border-border rounded-xl px-4 py-3.5 text-[15px] text-white placeholder:text-white/30 focus:outline-none focus:border-brand/50 focus:ring-4 focus:ring-brand/[0.12] transition-all'

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className ?? 'w-4 h-4'} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 6 9 17l-5-5"/>
    </svg>
  )
}

function SpinnerIcon() {
  return (
    <svg className="w-5 h-5 text-white/40 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <path d="M12 2v4" opacity="1"/><path d="M12 18v4" opacity=".3"/><path d="m4.93 4.93 2.83 2.83" opacity=".7"/>
      <path d="m16.24 16.24 2.83 2.83" opacity=".2"/><path d="M2 12h4" opacity=".5"/><path d="M18 12h4" opacity=".1"/>
      <path d="m4.93 19.07 2.83-2.83" opacity=".4"/><path d="m16.24 7.76 2.83-2.83" opacity=".6"/>
    </svg>
  )
}

function ProgressBar({ step }: { step: Step }) {
  const step3Label = step === 3 ? 'Photo' : 'Preferences'

  function Badge({ n }: { n: number }) {
    if (n < step) {
      return (
        <span className="w-7 h-7 rounded-full bg-brand/20 border border-brand/40 flex items-center justify-center shrink-0">
          <CheckIcon className="w-4 h-4 text-brand" />
        </span>
      )
    }
    if (n === step) {
      return (
        <span className="w-7 h-7 rounded-full bg-brand flex items-center justify-center text-[12px] font-bold text-black mainFont shrink-0">
          {n}
        </span>
      )
    }
    return (
      <span className="w-7 h-7 rounded-full border border-border bg-[#252525] flex items-center justify-center text-[12px] font-medium text-white/40 mainFont shrink-0">
        {n}
      </span>
    )
  }

  function Label({ n, children }: { n: number; children: string }) {
    return (
      <span className={`text-[13px] ${n === step ? 'font-medium text-white' : n < step ? 'text-white/50' : 'text-white/40'}`}>
        {children}
      </span>
    )
  }

  return (
    <div className="flex items-center gap-2 mb-8 px-1">
      <div className="flex items-center gap-2.5 flex-1">
        <Badge n={1} />
        <Label n={1}>Username</Label>
      </div>
      <div className={`h-px flex-1 max-w-[40px] ${step > 1 ? 'bg-brand/30' : 'bg-border'}`} />
      <div className="flex items-center gap-2.5 flex-1">
        <Badge n={2} />
        <Label n={2}>Profile</Label>
      </div>
      <div className={`h-px flex-1 max-w-[40px] ${step > 2 ? 'bg-brand/30' : 'bg-border'}`} />
      <div className="flex items-center gap-2.5 flex-1">
        <Badge n={3} />
        <Label n={3}>{step3Label}</Label>
      </div>
    </div>
  )
}

export function OnboardingFlow({ locale }: { locale: string }) {
  const [step, setStep] = useState<Step>(1)

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

  const usernameFieldClass = [
    'w-full bg-[#252525] border rounded-xl pl-9 pr-11 py-3.5 text-[15px] text-white placeholder:text-white/30 focus:outline-none focus:ring-4 transition-all',
    usernameStatus === 'valid'
      ? 'border-green-400/50 focus:border-green-400/50 focus:ring-green-400/[0.12]'
      : usernameStatus === 'error'
        ? 'border-red-400/50 focus:border-red-400/50 focus:ring-red-400/[0.10]'
        : 'border-border focus:border-brand/50 focus:ring-brand/[0.12]',
  ].join(' ')

  return (
    <div className="min-h-screen flex flex-col">
      {/* Backdrop */}
      <div className="fixed inset-0 hex-bg opacity-50 pointer-events-none [mask-image:radial-gradient(ellipse_60%_50%_at_50%_40%,black,transparent_75%)]" />
      <div className="fixed inset-0 auth-glow pointer-events-none" />

      {/* Header */}
      <header className="relative z-10">
        <div className="max-w-7xl mx-auto px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link href={`/${locale}`} className="flex items-center gap-2.5">
            <span className="relative inline-flex items-center justify-center w-9 h-9 rounded-xl bg-brand/15 border border-brand/30">
              <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="#FFC300" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2 L20 6.5 L20 15.5 L12 20 L4 15.5 L4 6.5 Z"/>
                <path d="M12 9 L16 11 L16 14.5 L12 16.5 L8 14.5 L8 11 Z" fill="#FFC300" fillOpacity="0.6" stroke="none"/>
              </svg>
            </span>
            <span className="mainFont font-bold text-[17px] tracking-tight">Beehive Studio</span>
          </Link>
          <span className="text-sm text-white/40">Step {step} of 3</span>
        </div>
      </header>

      {/* Main */}
      <main className="relative z-10 flex-1 flex items-center justify-center px-6 py-10">
        <div className="w-full max-w-md">
          <ProgressBar step={step} />

          <div className="paper-stack bg-card rounded-2xl p-8 sm:p-10">

            {/* ── Step 1: Username ─────────────────────────── */}
            {step === 1 && (
              <div>
                <div className="mb-7">
                  <span className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-brand/15 border border-brand/30 mb-5">
                    <svg viewBox="0 0 24 24" className="w-6 h-6 text-brand" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                      <circle cx="12" cy="7" r="4"/>
                    </svg>
                  </span>
                  <h1 className="mainFont font-bold text-[28px] leading-tight">Choose your username</h1>
                  <p className="text-white/55 text-[14.5px] mt-2.5 leading-relaxed">This is how other writers will find you.</p>
                </div>

                <form onSubmit={e => { e.preventDefault(); setStep(2) }} className="space-y-4">
                  <div>
                    <label htmlFor="username" className="block text-[13px] font-medium text-white/80 mb-1.5">Username</label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30 text-[15px] select-none pointer-events-none">@</span>
                      <input
                        id="username"
                        type="text"
                        autoComplete="username"
                        spellCheck={false}
                        autoCapitalize="off"
                        maxLength={24}
                        placeholder="mayavance"
                        value={username}
                        onChange={e => handleUsernameInput(e.target.value)}
                        className={usernameFieldClass}
                      />
                      <div className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center">
                        {usernameStatus === 'checking' && <SpinnerIcon />}
                        {usernameStatus === 'valid' && (
                          <svg className="w-5 h-5 text-green-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M20 6 9 17l-5-5"/>
                          </svg>
                        )}
                        {usernameStatus === 'error' && (
                          <svg className="w-5 h-5 text-red-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M18 6 6 18"/><path d="m6 6 12 12"/>
                          </svg>
                        )}
                      </div>
                    </div>
                    <div className="mt-2 text-[12.5px] leading-snug min-h-[18px]">
                      {usernameStatus === 'checking' && <span className="text-white/40">{usernameFeedback}</span>}
                      {usernameStatus === 'valid' && <span className="text-green-400">{usernameFeedback}</span>}
                      {usernameStatus === 'error' && <span className="text-red-400">{usernameFeedback}</span>}
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={usernameStatus !== 'valid'}
                    className="bg-brand text-[#0a0a0a] font-bold mainFont rounded-full w-full px-5 py-3.5 text-[15px] inline-flex items-center justify-center gap-2 mt-2 shadow-[0_6px_24px_-10px_rgba(255,195,0,0.55)] hover:bg-brand-hover hover:-translate-y-px disabled:opacity-35 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-none transition-all"
                  >
                    Continue
                    <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>
                    </svg>
                  </button>
                </form>

                <p className="text-white/35 text-[12px] mt-5 leading-relaxed text-center">
                  3–24 characters. Letters, numbers, underscores only.
                </p>
              </div>
            )}

            {/* ── Step 2: Bio ──────────────────────────────── */}
            {step === 2 && (
              <div>
                <div className="mb-7">
                  <span className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-brand/15 border border-brand/30 mb-5">
                    <svg viewBox="0 0 24 24" className="w-6 h-6 text-brand" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/>
                    </svg>
                  </span>
                  <h1 className="mainFont font-bold text-[28px] leading-tight">Tell us about yourself</h1>
                  <p className="text-white/55 text-[14.5px] mt-2.5 leading-relaxed">Optional — you can always add this later.</p>
                </div>

                <div className="space-y-4">
                  <div>
                    <label htmlFor="bio" className="block text-[13px] font-medium text-white/80 mb-1.5">Bio</label>
                    <textarea
                      id="bio"
                      maxLength={200}
                      rows={4}
                      placeholder="Novelist, night owl, tea enthusiast. Writing my first thriller set in coastal Cornwall."
                      value={bio}
                      onChange={e => setBio(e.target.value)}
                      className={`${fieldClass} resize-none`}
                    />
                    <div className="flex items-center justify-end mt-1.5">
                      <span className={`text-[12px] tabular-nums ${bio.length >= 180 ? 'text-brand/70' : 'text-white/35'}`}>
                        {bio.length} / 200
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 mt-2">
                    <button
                      type="button"
                      onClick={() => setStep(3)}
                      className="bg-brand text-[#0a0a0a] font-bold mainFont rounded-full flex-1 px-5 py-3.5 text-[15px] inline-flex items-center justify-center gap-2 shadow-[0_6px_24px_-10px_rgba(255,195,0,0.55)] hover:bg-brand-hover hover:-translate-y-px transition-all"
                    >
                      Continue
                      <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>
                      </svg>
                    </button>
                    <button
                      type="button"
                      onClick={() => setStep(3)}
                      className="mainFont rounded-full px-5 py-3.5 text-[15px] text-white/55 font-medium hover:text-white hover:bg-white/5 transition-all"
                    >
                      Skip
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* ── Step 3: Avatar ───────────────────────────── */}
            {step === 3 && (
              <div>
                <div className="mb-7 text-center">
                  <span className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-brand/15 border border-brand/30 mb-5">
                    <svg viewBox="0 0 24 24" className="w-6 h-6 text-brand" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                      <circle cx="12" cy="13" r="4"/>
                    </svg>
                  </span>
                  <h1 className="mainFont font-bold text-[28px] leading-tight">Add a profile photo</h1>
                  <p className="text-white/55 text-[14.5px] mt-2.5 leading-relaxed">Optional.</p>
                </div>

                <div className="flex flex-col items-center mb-8">
                  <div
                    role="button"
                    tabIndex={0}
                    aria-label="Upload profile photo"
                    onClick={() => fileInputRef.current?.click()}
                    onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileInputRef.current?.click() } }}
                    className={`w-[140px] h-[140px] rounded-full relative overflow-hidden cursor-pointer transition-all group ${
                      avatarPreview
                        ? 'border-2 border-brand/40 shadow-[0_0_0_4px_rgba(255,195,0,0.08)] hover:border-brand/60'
                        : 'border-2 border-dashed border-border bg-[#252525] hover:border-brand/50 hover:bg-[#2a2a2a] hover:scale-[1.02]'
                    }`}
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
                        <svg viewBox="0 0 24 24" className="w-10 h-10 text-brand/50" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M12 2 L20 6.5 L20 15.5 L12 20 L4 15.5 L4 6.5 Z"/>
                          <path d="M12 9 L16 11 L16 14.5 L12 16.5 L8 14.5 L8 11 Z" fill="currentColor" fillOpacity="0.3" stroke="none"/>
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
                    className="text-[13px] text-brand mt-4 hover:underline hover:underline-offset-4 transition-colors bg-transparent border-0"
                  >
                    {avatarPreview ? 'Change photo' : 'Click to upload'}
                  </button>

                  {avatarPreview && (
                    <button
                      type="button"
                      onClick={removeAvatar}
                      className="text-[12px] text-white/40 mt-1.5 hover:text-white/70 transition-colors"
                    >
                      Remove photo
                    </button>
                  )}
                </div>

                {submitError && (
                  <p className="text-[13px] text-red-400 bg-red-400/10 border border-red-400/20 rounded-xl px-4 py-3 mb-4">
                    {submitError}
                  </p>
                )}

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={handleFinish}
                    disabled={submitting}
                    className="bg-brand text-[#0a0a0a] font-bold mainFont rounded-full flex-1 px-5 py-3.5 text-[15px] inline-flex items-center justify-center gap-2 shadow-[0_6px_24px_-10px_rgba(255,195,0,0.55)] hover:bg-brand-hover hover:-translate-y-px disabled:opacity-40 disabled:cursor-not-allowed disabled:transform-none transition-all"
                  >
                    {submitting ? 'Setting up…' : 'Finish setup'}
                    {!submitting && (
                      <CheckIcon className="w-4 h-4" />
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={handleFinish}
                    disabled={submitting}
                    className="mainFont rounded-full px-5 py-3.5 text-[15px] text-white/55 font-medium hover:text-white hover:bg-white/5 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                  >
                    Skip for now
                  </button>
                </div>
              </div>
            )}

          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 py-6">
        <div className="max-w-7xl mx-auto px-6 lg:px-8 flex flex-wrap items-center justify-between gap-3 text-[12px] text-white/40">
          <div>© 2026 Beehive Studio</div>
          <div className="flex items-center gap-5">
            <Link href={`/${locale}/privacy`} className="hover:text-white/70 transition-colors">Privacy</Link>
            <Link href={`/${locale}/terms`} className="hover:text-white/70 transition-colors">Terms</Link>
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
