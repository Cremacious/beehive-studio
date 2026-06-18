'use client'

import { useState } from 'react'
import { CalendarIcon, ChevronLeft, ChevronRight, ChevronDown } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]
const DAY_LABELS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']
const MINUTE_OPTIONS = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55]

function formatDisplay(d: Date): string {
  return d.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
}

type Props = {
  value: Date
  onChange: (d: Date) => void
  disabled?: boolean
}

export function DateTimePicker({ value, onChange, disabled }: Props) {
  const [open, setOpen] = useState(false)
  const [viewYear, setViewYear] = useState(() => value.getFullYear())
  const [viewMonth, setViewMonth] = useState(() => value.getMonth())

  const hour12 = value.getHours() % 12 || 12
  const amPm: 'AM' | 'PM' = value.getHours() < 12 ? 'AM' : 'PM'
  const minute = value.getMinutes()

  function pickDay(day: number) {
    const next = new Date(value)
    next.setFullYear(viewYear, viewMonth, day)
    onChange(next)
  }

  function setTime(h24: number, m: number) {
    const next = new Date(value)
    next.setHours(h24, m, 0, 0)
    onChange(next)
  }

  function prevMonth() {
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11) }
    else setViewMonth(m => m - 1)
  }

  function nextMonth() {
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0) }
    else setViewMonth(m => m + 1)
  }

  // Build the calendar grid (Sun-first)
  const firstDow = new Date(viewYear, viewMonth, 1).getDay()
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate()
  const cells: (number | null)[] = [
    ...Array<null>(firstDow).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ]
  while (cells.length % 7 !== 0) cells.push(null)

  const today = new Date()
  const selY = value.getFullYear(), selM = value.getMonth(), selD = value.getDate()

  function handleHourChange(h12: number) {
    const h24 = amPm === 'AM' ? (h12 === 12 ? 0 : h12) : (h12 === 12 ? 12 : h12 + 12)
    setTime(h24, minute)
  }

  function handleMinuteChange(m: number) {
    const h24 = amPm === 'AM' ? (hour12 === 12 ? 0 : hour12) : (hour12 === 12 ? 12 : hour12 + 12)
    setTime(h24, m)
  }

  function handleAmPmChange(ap: 'AM' | 'PM') {
    const h24 = ap === 'AM' ? (hour12 === 12 ? 0 : hour12) : (hour12 === 12 ? 12 : hour12 + 12)
    setTime(h24, minute)
  }

  return (
    <Popover open={open} onOpenChange={disabled ? undefined : setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          style={{
            background: 'var(--canvas-dark-100)',
            boxShadow: 'var(--sh-inset)',
            border: '0.5px solid rgba(255,255,255,0.04)',
            borderRadius: 'var(--r-row)',
            color: disabled ? 'var(--canvas-dark-ink-muted)' : 'var(--canvas-dark-ink)',
            height: 40,
            display: 'flex',
            alignItems: 'center',
            padding: '0 14px',
            gap: 8,
            width: '100%',
            textAlign: 'left',
            cursor: disabled ? 'not-allowed' : 'pointer',
            opacity: disabled ? 0.5 : 1,
          }}
        >
          <CalendarIcon size={14} style={{ color: 'var(--canvas-dark-ink-muted)', flexShrink: 0 }} />
          <span style={{ flex: 1, fontSize: 14, fontFamily: 'inherit' }}>{formatDisplay(value)}</span>
          <ChevronDown size={12} style={{ color: 'var(--canvas-dark-ink-muted)', flexShrink: 0 }} />
        </button>
      </PopoverTrigger>

      <PopoverContent
        align="start"
        sideOffset={6}
        className="p-0"
        style={{
          width: 296,
          background: 'linear-gradient(180deg, var(--canvas-dark-350), var(--canvas-dark-300))',
          boxShadow: '0 8px 32px rgba(0,0,0,0.55), 0 2px 8px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.05)',
          border: '0.5px solid rgba(255,255,255,0.08)',
          borderRadius: 'var(--r-card)',
          padding: 16,
        }}
      >
        {/* Month navigation */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <button
            type="button"
            onClick={prevMonth}
            style={NAV_BTN}
            aria-label="Previous month"
          >
            <ChevronLeft size={14} />
          </button>
          <span style={{ fontFamily: 'var(--font-display)', fontSize: 13, fontWeight: 700, color: 'var(--canvas-dark-ink-strong)' }}>
            {MONTHS[viewMonth]} {viewYear}
          </span>
          <button
            type="button"
            onClick={nextMonth}
            style={NAV_BTN}
            aria-label="Next month"
          >
            <ChevronRight size={14} />
          </button>
        </div>

        {/* Day of week headers */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2, marginBottom: 4 }}>
          {DAY_LABELS.map(d => (
            <div
              key={d}
              style={{
                textAlign: 'center',
                fontSize: 10,
                color: 'var(--canvas-dark-ink-muted)',
                fontFamily: 'monospace',
                textTransform: 'uppercase',
                padding: '2px 0',
                fontWeight: 600,
              }}
            >
              {d}
            </div>
          ))}
        </div>

        {/* Day cells */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2 }}>
          {cells.map((day, i) => {
            if (!day) return <div key={i} />
            const isSel = day === selD && viewMonth === selM && viewYear === selY
            const isToday =
              day === today.getDate() &&
              viewMonth === today.getMonth() &&
              viewYear === today.getFullYear()
            return (
              <button
                key={i}
                type="button"
                onClick={() => pickDay(day)}
                style={{
                  height: 32,
                  borderRadius: 8,
                  fontSize: 12,
                  fontWeight: isSel ? 700 : 400,
                  background: isSel
                    ? 'var(--brand)'
                    : isToday
                    ? 'rgba(255,255,255,0.06)'
                    : 'transparent',
                  color: isSel ? 'var(--brand-ink)' : 'var(--canvas-dark-ink)',
                  border: 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'background 0.1s',
                  fontFamily: 'monospace',
                }}
              >
                {day}
              </button>
            )
          })}
        </div>

        {/* Time picker */}
        <div style={{
          marginTop: 12,
          paddingTop: 12,
          borderTop: '1px solid rgba(255,255,255,0.06)',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
        }}>
          <span style={{ fontSize: 10, color: 'var(--canvas-dark-ink-muted)', fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 600, flexShrink: 0 }}>
            Time
          </span>
          <select
            value={hour12}
            onChange={e => handleHourChange(parseInt(e.target.value, 10))}
            style={TIME_SELECT}
            aria-label="Hour"
          >
            {Array.from({ length: 12 }, (_, i) => i + 1).map(h => (
              <option key={h} value={h}>{String(h).padStart(2, '0')}</option>
            ))}
          </select>
          <span style={{ color: 'var(--canvas-dark-ink-muted)', fontSize: 14, fontFamily: 'monospace' }}>:</span>
          <select
            value={minute}
            onChange={e => handleMinuteChange(parseInt(e.target.value, 10))}
            style={TIME_SELECT}
            aria-label="Minute"
          >
            {MINUTE_OPTIONS.map(m => (
              <option key={m} value={m}>{String(m).padStart(2, '0')}</option>
            ))}
          </select>
          <select
            value={amPm}
            onChange={e => handleAmPmChange(e.target.value as 'AM' | 'PM')}
            style={TIME_SELECT}
            aria-label="AM or PM"
          >
            <option value="AM">AM</option>
            <option value="PM">PM</option>
          </select>
        </div>

        {/* Done */}
        <button
          type="button"
          onClick={() => setOpen(false)}
          style={{
            marginTop: 12,
            width: '100%',
            height: 34,
            borderRadius: 'var(--r-pill)',
            background: 'var(--brand)',
            color: 'var(--brand-ink)',
            fontSize: 12,
            fontWeight: 700,
            border: 'none',
            cursor: 'pointer',
            fontFamily: 'inherit',
          }}
        >
          Done
        </button>
      </PopoverContent>
    </Popover>
  )
}

const NAV_BTN: React.CSSProperties = {
  width: 28,
  height: 28,
  borderRadius: 8,
  background: 'rgba(255,255,255,0.06)',
  border: 'none',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: 'var(--canvas-dark-ink)',
}

const TIME_SELECT: React.CSSProperties = {
  background: 'var(--canvas-dark-100)',
  boxShadow: 'var(--sh-inset)',
  border: '0.5px solid rgba(255,255,255,0.04)',
  borderRadius: 8,
  color: 'var(--canvas-dark-ink)',
  fontSize: 13,
  height: 30,
  padding: '0 6px',
  appearance: 'none',
  textAlign: 'center',
  fontFamily: 'monospace',
  minWidth: 38,
  cursor: 'pointer',
}
