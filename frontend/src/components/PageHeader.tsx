import type { ReactNode } from 'react'
import { MessageSquareText, Moon, Sun } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
type PageHeaderProps = {
  title: string
  description?: string
  actions?: ReactNode
  agentOpen?: boolean
  agentPending?: boolean
  onAgentToggle?: () => void
  theme?: 'dark' | 'light'
  onThemeToggle?: () => void
}

export function PageHeader({
  title,
  description,
  actions,
  agentOpen,
  agentPending,
  onAgentToggle,
  theme = 'dark',
  onThemeToggle,
}: PageHeaderProps) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0 max-w-[65ch]">
        <h1 className="text-[26px] font-semibold leading-tight tracking-tight">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {actions}
        {onThemeToggle && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="icon"
                aria-label={theme === 'dark' ? 'Helles Theme' : 'Dunkles Theme'}
                onClick={onThemeToggle}
              >
                {theme === 'dark' ? <Sun className="size-4" /> : <Moon className="size-4" />}
              </Button>
            </TooltipTrigger>
            <TooltipContent>{theme === 'dark' ? 'Helles Theme' : 'Dunkles Theme'}</TooltipContent>
          </Tooltip>
        )}
        {onAgentToggle && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant={agentOpen ? 'secondary' : 'outline'}
                size="icon"
                className="relative"
                aria-label="Agent öffnen"
                aria-expanded={agentOpen}
                onClick={onAgentToggle}
              >
                <MessageSquareText className="size-4" />
                {agentPending && (
                  <span className="absolute right-1 top-1 size-2 rounded-full bg-primary" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent>Agent öffnen</TooltipContent>
          </Tooltip>
        )}
      </div>
    </div>
  )
}
