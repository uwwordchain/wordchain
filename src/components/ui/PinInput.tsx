'use client'
import { useRef, useState } from 'react'

export function PinInput({ onChange }: { onChange: (pin: string) => void }) {
  const [digits, setDigits] = useState(['', '', '', ''])
  const refs = [
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
  ]

  const handleChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return
    const newDigits = [...digits]
    newDigits[index] = value.slice(-1)
    setDigits(newDigits)
    onChange(newDigits.join(''))
    if (value && index < 3) refs[index + 1].current?.focus()
  }

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      refs[index - 1].current?.focus()
    }
  }

  return (
    <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
      {digits.map((digit, i) => (
        <input
          key={i}
          ref={refs[i]}
          type="password"
          inputMode="numeric"
          maxLength={1}
          value={digit}
          onChange={e => handleChange(i, e.target.value)}
          onKeyDown={e => handleKeyDown(i, e)}
          className={`otp-box${digit ? '' : ' empty'}`}
        />
      ))}
    </div>
  )
}
