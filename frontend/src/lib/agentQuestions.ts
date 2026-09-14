import type { AgentViewportContext } from '@/hooks/useAgentViewportContext'

export const HERO_SITE_ID = 'DE-NRW-0107'

export function starterPrompts(viewport?: AgentViewportContext): string[] {
  const selected = viewport?.selectedFinding
  const explain = selected
    ? 'Erkläre diesen Befund'
    : `Warum ist ${HERO_SITE_ID} kritisch?`
  const notion = selected
    ? 'Schreibe diesen Befund in Notion'
    : `Schreibe ${HERO_SITE_ID} in Notion`
  return [
    explain,
    'Welche Quelle belegt das?',
    'Nächste Schritte vorschlagen',
    notion,
  ]
}
