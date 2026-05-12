'use client'

import { useState, useRef, useEffect } from 'react'
import { cn } from '@/lib/utils'

type SoundName = 'white' | 'pink' | 'brown' | 'rain' | 'cafe'

const SOUNDS: { id: SoundName; label: string; emoji: string }[] = [
  { id: 'white', label: 'White Noise', emoji: '〰' },
  { id: 'pink', label: 'Pink Noise', emoji: '🌧' },
  { id: 'brown', label: 'Brown Noise', emoji: '🌊' },
  { id: 'rain', label: 'Rain', emoji: '☔' },
  { id: 'cafe', label: 'Café', emoji: '☕' },
]

export function AmbientSounds() {
  const [isOpen, setIsOpen] = useState(false)
  const [activeSound, setActiveSound] = useState<SoundName | null>(null)
  const [volume, setVolume] = useState(0.4)
  const audioCtxRef = useRef<AudioContext | null>(null)
  const nodesRef = useRef<{ source: AudioBufferSourceNode; gainNode: GainNode } | null>(null)

  function stopSound() {
    try { nodesRef.current?.source.stop() } catch {}
    nodesRef.current = null
  }

  function playSound(name: SoundName) {
    stopSound()

    if (typeof window === 'undefined') return

    const ctx = audioCtxRef.current ?? new AudioContext()
    audioCtxRef.current = ctx

    if (ctx.state === 'suspended') ctx.resume()

    const bufferSize = ctx.sampleRate * 2
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate)
    const data = buffer.getChannelData(0)
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1

    const source = ctx.createBufferSource()
    source.buffer = buffer
    source.loop = true

    const gainNode = ctx.createGain()
    gainNode.gain.value = volume

    let lastNode: AudioNode = source

    if (name === 'pink' || name === 'rain') {
      const f = ctx.createBiquadFilter()
      f.type = 'lowshelf'
      f.frequency.value = 100
      f.gain.value = 12
      source.connect(f)
      lastNode = f
    }

    if (name === 'brown' || name === 'cafe') {
      const f = ctx.createBiquadFilter()
      f.type = 'lowpass'
      f.frequency.value = 200
      source.connect(f)
      lastNode = f
    }

    if (name === 'rain') {
      const src2 = ctx.createBufferSource()
      src2.buffer = buffer
      src2.loop = true
      const hp = ctx.createBiquadFilter()
      hp.type = 'highpass'
      hp.frequency.value = 2000
      const g2 = ctx.createGain()
      g2.gain.value = 0.3
      src2.connect(hp)
      hp.connect(g2)
      g2.connect(gainNode)
      src2.start()
    }

    if (name === 'white') source.connect(gainNode)
    else lastNode.connect(gainNode)

    gainNode.connect(ctx.destination)
    source.start()
    nodesRef.current = { source, gainNode }
  }

  function toggleSound(name: SoundName) {
    if (activeSound === name) {
      stopSound()
      setActiveSound(null)
    } else {
      playSound(name)
      setActiveSound(name)
    }
  }

  useEffect(() => () => stopSound(), [])

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="absolute bottom-4 left-4 text-xs text-foreground/40 hover:text-foreground/70 bg-surface border border-border rounded-full px-3 py-1.5 transition-colors"
      >
        🎵 Sounds
      </button>
    )
  }

  return (
    <div className="absolute bottom-4 left-4 bg-surface-elevated border border-border rounded-xl p-4 w-52 shadow-xl z-10">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-foreground">Ambient Sounds</span>
        <button
          onClick={() => setIsOpen(false)}
          className="text-muted-foreground hover:text-foreground text-xs leading-none"
        >
          ×
        </button>
      </div>

      <div className="grid grid-cols-2 gap-1.5 mt-3">
        {SOUNDS.map(s => (
          <button
            key={s.id}
            onClick={() => toggleSound(s.id)}
            className={cn(
              'text-xs px-2 py-2 rounded-lg border text-left flex flex-col gap-0.5',
              activeSound === s.id
                ? 'border-brand bg-brand/10 text-brand'
                : 'border-border text-muted-foreground hover:border-brand/40 hover:text-foreground',
            )}
          >
            <span>{s.emoji}</span>
            <span>{s.label}</span>
          </button>
        ))}
      </div>

      {activeSound !== null && (
        <div className="mt-3 flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Vol</span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={volume}
            onChange={e => {
              const v = parseFloat(e.target.value)
              setVolume(v)
              if (nodesRef.current) nodesRef.current.gainNode.gain.value = v
            }}
            className="flex-1 accent-[#FFC300]"
          />
        </div>
      )}
    </div>
  )
}
