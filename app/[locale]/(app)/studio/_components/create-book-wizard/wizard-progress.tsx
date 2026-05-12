type Props = { step: 1 | 2 | 3 }

const LABELS = ['The Basics', 'Discovery', 'Structure']

export function WizardProgress({ step }: Props) {
  return (
    <div className="mb-8">
      <div className="flex items-center justify-center gap-2 mb-3">
        {([1, 2, 3] as const).map((n, i) => (
          <div key={n} className="flex items-center gap-2">
            {i > 0 && <div className={`w-10 h-px ${step > n - 1 ? 'bg-brand/60' : 'bg-border'}`} />}
            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold font-comfortaa transition-colors
              ${step === n ? 'bg-brand text-[#0a0a0a]' : step > n ? 'bg-brand/30 border border-brand/50 text-brand' : 'bg-transparent border border-border text-white/30'}`}>
              {step > n ? (
                <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 6 9 17l-5-5"/>
                </svg>
              ) : n}
            </div>
          </div>
        ))}
      </div>
      <div className="text-center">
        <span className="text-[11px] text-white/40 font-medium uppercase tracking-wider">
          Step {step} of 3 — {LABELS[step - 1]}
        </span>
      </div>
      <div className="mt-3 h-0.5 bg-border rounded-full overflow-hidden">
        <div
          className="h-full bg-brand rounded-full transition-all duration-300"
          style={{ width: `${(step / 3) * 100}%` }}
        />
      </div>
    </div>
  )
}
