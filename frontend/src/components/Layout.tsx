import type { ReactNode } from 'react'

type LayoutProps = {
  header: ReactNode
  children: ReactNode
}

export function Layout({ header, children }: LayoutProps) {
  return (
    <div className="min-h-dvh bg-background">
      <div className="sticky top-0 z-40 border-b border-border bg-card/95 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-card/85">
        {header}
      </div>
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">{children}</main>
    </div>
  )
}
