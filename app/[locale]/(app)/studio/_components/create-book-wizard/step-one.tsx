'use client'

import { useRef, useState } from 'react'
import { useCloudinaryUpload } from '@/hooks/use-cloudinary-upload'

const field = 'w-full bg-[#1c1c1c] border border-border rounded-xl px-4 py-3 text-[14px] text-white placeholder:text-white/25 focus:outline-none focus:border-brand/50 focus:ring-2 focus:ring-brand/10 transition-all'
const label = 'block text-[12px] font-medium text-white/60 mb-1.5'

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

const cloudinaryConfigured = !!process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME

export function StepOne({ title, subtitle, synopsis, coverUrl, onUpdate, onNext, onCancel, titleError }: Props) {
  const { upload, uploading } = useCloudinaryUpload('covers')
  const [preview, setPreview] = useState<string | null>(coverUrl)
  const fileRef = useRef<HTMLInputElement>(null)

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setPreview(URL.createObjectURL(file))
    if (cloudinaryConfigured) {
      const result = await upload(file)
      if (result) onUpdate({ coverUrl: result.url })
    }
  }

  return (
    <div>
      <div className="space-y-4">
        <div>
          <label className={label}>Title <span className="text-brand">*</span></label>
          <input
            type="text"
            placeholder="Give your book a title"
            value={title}
            onChange={e => onUpdate({ title: e.target.value })}
            className={`${field} ${titleError ? 'border-red-400/50 focus:border-red-400/50' : ''}`}
            autoFocus
          />
          {titleError && <p className="text-[12px] text-red-400 mt-1">{titleError}</p>}
        </div>

        <div>
          <label className={label}>Subtitle <span className="text-white/30 font-normal">optional</span></label>
          <input
            type="text"
            placeholder="A subtitle or tagline"
            value={subtitle}
            onChange={e => onUpdate({ subtitle: e.target.value })}
            className={field}
          />
        </div>

        <div>
          <label className={label}>Synopsis <span className="text-white/30 font-normal">optional</span></label>
          <textarea
            placeholder="Back-cover blurb or a brief summary…"
            value={synopsis}
            onChange={e => onUpdate({ synopsis: e.target.value })}
            rows={4}
            maxLength={2000}
            className={`${field} resize-none`}
          />
          <p className="text-[11px] text-white/25 mt-1 text-right">{synopsis.length}/2000</p>
        </div>

        <div>
          <label className={label}>Cover image <span className="text-white/30 font-normal">optional</span></label>
          <div
            onClick={() => cloudinaryConfigured && fileRef.current?.click()}
            className={`relative border border-dashed border-border rounded-xl overflow-hidden flex items-center justify-center
              ${cloudinaryConfigured ? 'cursor-pointer hover:border-brand/40 transition-colors' : 'opacity-40 cursor-not-allowed'}
              ${preview ? 'h-40' : 'h-28'}`}
          >
            {preview ? (
              <img src={preview} alt="Cover preview" className="w-full h-full object-cover" />
            ) : (
              <div className="text-center">
                <p className="text-[13px] text-white/40">
                  {cloudinaryConfigured ? (uploading ? 'Uploading…' : 'Click to upload cover') : 'Cover upload unavailable in this environment'}
                </p>
                {cloudinaryConfigured && <p className="text-[11px] text-white/25 mt-1">Portrait ratio recommended · PNG or JPG</p>}
              </div>
            )}
            {uploading && (
              <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                <div className="w-6 h-6 border-2 border-brand border-t-transparent rounded-full animate-spin" />
              </div>
            )}
          </div>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
          {preview && cloudinaryConfigured && (
            <button
              type="button"
              onClick={() => { setPreview(null); onUpdate({ coverUrl: null }) }}
              className="text-[11px] text-white/35 hover:text-white/60 mt-1 transition-colors"
            >
              Remove cover
            </button>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between mt-8">
        <button type="button" onClick={onCancel} className="text-[13px] text-white/40 hover:text-white/70 transition-colors">Cancel</button>
        <button
          type="button"
          onClick={() => { if (!title.trim()) return; onNext() }}
          disabled={!title.trim()}
          className="bg-brand text-[#0a0a0a] font-bold font-comfortaa rounded-full px-6 py-2.5 text-[13px] disabled:opacity-40 disabled:cursor-not-allowed hover:bg-brand-hover hover:-translate-y-px transition-all"
        >
          Next →
        </button>
      </div>
    </div>
  )
}
