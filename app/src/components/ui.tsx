import { useEffect, useRef, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { X, ArrowUpRight } from 'lucide-react'

export function Mark({ small = false }: { small?: boolean }) {
  return (
    <span className={`brand-mark ${small ? 'small' : ''}`} aria-hidden="true">
      <i />
      <i />
      <i />
      <i />
      <i />
    </span>
  )
}
export function GlassButton({
  children,
  className = '',
  dark = false,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { dark?: boolean }) {
  return (
    <button className={`glass-button ${dark ? 'glass-dark' : ''} ${className}`} {...props}>
      {children}
    </button>
  )
}
export function EmptyState({
  title,
  text,
  children,
}: {
  title: string
  text: string
  children?: ReactNode
}) {
  return (
    <div className="empty-state">
      <Mark />
      <h2>{title}</h2>
      <p>{text}</p>
      {children}
    </div>
  )
}
export function SectionTitle({
  title,
  label,
  action,
}: {
  title: string
  label?: string
  action?: ReactNode
}) {
  return (
    <div className="section-heading">
      <div>
        {label && <span className="eyebrow">{label}</span>}
        <h2>{title}</h2>
      </div>
      {action}
    </div>
  )
}
export function TextLink({ children, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button className="text-link" {...props}>
      {children}
      <ArrowUpRight size={15} />
    </button>
  )
}
export function Dialog({
  title,
  children,
  onClose,
}: {
  title: string
  children: ReactNode
  onClose: () => void
}) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    const dialog = ref.current!
    dialog.showModal()
    const scrollY = window.scrollY
    document.body.style.overflow = 'hidden'
    return () => {
      dialog.close()
      document.body.style.overflow = ''
      previous?.focus({ preventScroll: true })
      window.scrollTo(0, scrollY)
    }
  }, [])
  return (
    <dialog
      ref={ref}
      aria-labelledby="dialog-title"
      className="dialog"
      onCancel={(e) => {
        e.preventDefault()
        onClose()
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          const r = ref.current!.getBoundingClientRect()
          if (
            e.clientX < r.left ||
            e.clientX > r.right ||
            e.clientY < r.top ||
            e.clientY > r.bottom
          )
            onClose()
        }
      }}
    >
      <header>
        <h2 id="dialog-title">{title}</h2>
        <button className="icon-button" aria-label="关闭" onClick={onClose}>
          <X size={21} />
        </button>
      </header>
      {children}
    </dialog>
  )
}
