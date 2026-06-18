'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

// Search bar for the Archive view. Controlled input seeded from the URL ?q=, pushes a
// new URL on submit (resetting to page 1 by omitting page). No <form> — button onClick
// and Enter keydown only.
export function ArchiveSearch() {
  const router = useRouter()
  const currentQ = useSearchParams().get('q') ?? ''
  const [value, setValue] = useState(currentQ)

  const submit = () => {
    const trimmed = value.trim()
    // New search resets to page 1 (page omitted).
    router.push(trimmed ? `/home/archive?q=${encodeURIComponent(trimmed)}` : '/home/archive')
  }

  const clear = () => {
    setValue('')
    router.push('/home/archive')
  }

  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
      <input
        type="text"
        value={value}
        placeholder="Search briefings"
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') submit()
        }}
        style={{
          flex: '0 1 320px',
          border: '1px solid var(--hairline)',
          padding: 8,
          background: 'var(--ground-raised)',
          color: 'var(--ink)',
          fontFamily: 'inherit',
          fontSize: 14,
        }}
      />
      <button onClick={submit} className="btn btn-primary" style={{ fontSize: 13 }}>
        Search
      </button>
      {currentQ ? (
        <button onClick={clear} className="btn" style={{ fontSize: 13 }}>
          Clear
        </button>
      ) : null}
    </div>
  )
}
