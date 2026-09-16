import { cva, type VariantProps } from 'class-variance-authority'
import * as React from 'react'
import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'inline-flex items-center gap-1.5 text-xs font-medium transition-colors',
  {
    variants: {
      variant: {
        default: 'rounded-md bg-primary px-2 py-0.5 text-primary-foreground',
        outline: 'rounded-md border border-border px-2 py-0.5 text-foreground',
        critical:
          "text-[var(--critical)] before:size-1.5 before:shrink-0 before:rounded-full before:bg-current before:content-['']",
        warning:
          "text-[var(--warn)] before:size-1.5 before:shrink-0 before:rounded-full before:bg-current before:content-['']",
        muted: 'rounded-md bg-muted px-2 py-0.5 text-muted-foreground',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
)

export function Badge({
  className,
  variant,
  ...props
}: React.ComponentProps<'span'> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />
}
