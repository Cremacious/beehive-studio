'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { updateProfileAction } from '@/lib/actions/settings.actions'

interface ProfileFormProps {
  displayName: string | null
  username: string | null
  bio: string | null
  website: string | null
  location: string | null
}

export function ProfileForm({ displayName, username, bio, website, location }: ProfileFormProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const [fields, setFields] = useState({
    displayName: displayName ?? '',
    username: username ?? '',
    bio: bio ?? '',
    website: website ?? '',
    location: location ?? '',
  })

  function set(key: keyof typeof fields, value: string) {
    setFields((f) => ({ ...f, [key]: value }))
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    startTransition(async () => {
      const result = await updateProfileAction({
        displayName: fields.displayName,
        username: fields.username || undefined,
        bio: fields.bio,
        website: fields.website,
        location: fields.location,
      })
      if (!result.success) {
        toast.error(result.error ?? 'Could not save changes.')
        return
      }
      toast.success('Profile saved.')
      router.refresh()
    })
  }

  const inputStyle = {
    background: 'var(--canvas-dark-100)',
    boxShadow: 'var(--sh-inset)',
    color: 'var(--canvas-dark-ink-strong)',
    borderRadius: 'var(--r-row)',
  } as const

  const labelStyle = {
    color: 'var(--canvas-dark-ink-muted)',
    fontFamily: 'var(--font-mono)',
    fontSize: '11px',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.07em',
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {/* Display name + Username row */}
      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="displayName" style={labelStyle}>
            Display name
          </label>
          <input
            id="displayName"
            type="text"
            value={fields.displayName}
            onChange={(e) => set('displayName', e.target.value)}
            placeholder="Your name"
            maxLength={50}
            disabled={isPending}
            className="px-4 py-2.5 text-[14px] focus:outline-none focus:ring-[3px] focus:ring-[var(--brand)] focus:ring-opacity-30 disabled:opacity-50 transition-all"
            style={inputStyle}
          />
          <span className="text-[11px]" style={{ color: 'var(--canvas-dark-ink-muted)' }}>
            {fields.displayName.length}/50
          </span>
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="username" style={labelStyle}>
            Username
          </label>
          <div className="relative">
            <span
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[14px] pointer-events-none select-none"
              style={{ color: 'var(--canvas-dark-ink-muted)' }}
            >
              @
            </span>
            <input
              id="username"
              type="text"
              value={fields.username}
              onChange={(e) => set('username', e.target.value.replace(/[^a-zA-Z0-9_]/g, ''))}
              placeholder="your_username"
              maxLength={20}
              minLength={3}
              disabled={isPending}
              className="w-full pl-8 pr-4 py-2.5 text-[14px] focus:outline-none focus:ring-[3px] focus:ring-[var(--brand)] focus:ring-opacity-30 disabled:opacity-50 transition-all"
              style={inputStyle}
            />
          </div>
          <span className="text-[11px]" style={{ color: 'var(--canvas-dark-ink-muted)' }}>
            3-20 chars, letters/numbers/underscores
          </span>
        </div>
      </div>

      {/* Bio */}
      <div className="flex flex-col gap-1.5">
        <label htmlFor="bio" style={labelStyle}>
          Bio
        </label>
        <textarea
          id="bio"
          value={fields.bio}
          onChange={(e) => set('bio', e.target.value)}
          placeholder="A few words about you..."
          maxLength={200}
          rows={3}
          disabled={isPending}
          className="px-4 py-2.5 text-[14px] resize-none focus:outline-none focus:ring-[3px] focus:ring-[var(--brand)] focus:ring-opacity-30 disabled:opacity-50 transition-all"
          style={inputStyle}
        />
        <span className="text-[11px]" style={{ color: 'var(--canvas-dark-ink-muted)' }}>
          {fields.bio.length}/200
        </span>
      </div>

      {/* Website + Location row */}
      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="website" style={labelStyle}>
            Website
          </label>
          <input
            id="website"
            type="url"
            value={fields.website}
            onChange={(e) => set('website', e.target.value)}
            placeholder="https://yoursite.com"
            maxLength={200}
            disabled={isPending}
            className="px-4 py-2.5 text-[14px] focus:outline-none focus:ring-[3px] focus:ring-[var(--brand)] focus:ring-opacity-30 disabled:opacity-50 transition-all"
            style={inputStyle}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="location" style={labelStyle}>
            Location
          </label>
          <input
            id="location"
            type="text"
            value={fields.location}
            onChange={(e) => set('location', e.target.value)}
            placeholder="City, Country"
            maxLength={100}
            disabled={isPending}
            className="px-4 py-2.5 text-[14px] focus:outline-none focus:ring-[3px] focus:ring-[var(--brand)] focus:ring-opacity-30 disabled:opacity-50 transition-all"
            style={inputStyle}
          />
        </div>
      </div>

      {/* Save */}
      <div className="flex justify-end pt-1">
        <button
          type="submit"
          disabled={isPending}
          className="px-5 py-2.5 text-[13px] font-semibold rounded-[12px] disabled:opacity-50 disabled:cursor-not-allowed transition-all hover:-translate-y-px disabled:transform-none"
          style={{
            background: 'var(--brand)',
            color: 'var(--brand-ink)',
            fontFamily: 'var(--font-display)',
          }}
        >
          {isPending ? 'Saving...' : 'Save changes'}
        </button>
      </div>
    </form>
  )
}
