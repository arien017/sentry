'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

// Five primary views. Today/Alerts/Archive are live links; Chat/Tracker are
// present-but-disabled (those segments don't exist yet) — inert, --ink-faint.
const LIVE = [
  { label: 'Today', href: '/home/today' },
  { label: 'Alerts', href: '/home/alerts' },
  { label: 'Archive', href: '/home/archive' },
] as const

const DISABLED = ['Chat', 'Tracker'] as const

export function LeftRail() {
  const pathname = usePathname()

  return (
    <nav style={{ display: 'flex', flexDirection: 'column', gap: 2, padding: 12 }}>
      {LIVE.map((item) => {
        const active = pathname === item.href || pathname.startsWith(item.href + '/')
        return (
          <Link
            key={item.href}
            href={item.href}
            className="t-caption-emph"
            style={{
              display: 'block',
              padding: '8px 12px',
              borderRadius: 4,
              background: active ? 'var(--signal-tint)' : 'transparent',
              color: active ? 'var(--signal)' : 'var(--ink-mute)',
            }}
          >
            {item.label}
          </Link>
        )
      })}

      {DISABLED.map((label) => (
        <span
          key={label}
          className="t-caption-emph"
          aria-disabled="true"
          style={{
            display: 'block',
            padding: '8px 12px',
            color: 'var(--ink-faint)',
            cursor: 'not-allowed',
          }}
        >
          {label}
        </span>
      ))}
    </nav>
  )
}
