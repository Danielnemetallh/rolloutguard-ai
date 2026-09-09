type MarkProps = {
  className?: string
}

export function Mark({ className }: MarkProps) {
  return (
    <span
      className={className}
      aria-hidden="true"
      style={{ fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: '0.7rem' }}
    >
      RG
    </span>
  )
}
