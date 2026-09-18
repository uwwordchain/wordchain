'use client'
import { useState } from 'react'

interface AccordionProps {
  title: string
  children: React.ReactNode
  defaultOpen?: boolean
}

export function Accordion({ title, children, defaultOpen = false }: AccordionProps) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div style={{ borderBottom: '1px solid var(--border-light)' }}>
      <button className="accordion-trigger" onClick={() => setOpen(!open)}>
        {title}
        <span style={{ fontSize: 'var(--text-xl)', lineHeight: 1 }}>{open ? '−' : '+'}</span>
      </button>
      {open && <div className="accordion-body">{children}</div>}
    </div>
  )
}
