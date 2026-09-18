import { ButtonHTMLAttributes } from 'react'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'outline' | 'ghost'
}

export function Button({ variant = 'primary', className = '', children, ...props }: ButtonProps) {
  return (
    <button
      className={`${variant === 'primary' ? 'btn-primary' : variant === 'outline' ? 'btn-outline' : 'btn-ghost'} ${className}`}
      {...props}
    >
      {children}
    </button>
  )
}
