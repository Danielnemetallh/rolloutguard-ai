# RolloutGuard Evidence-First Frontend Redesign

## Summary

Redesign the frontend on top of `origin/agentic-deepseek-composio` as a desktop-first, three-column operations workbench:

```text
Collapsible navigation | Main workspace | Collapsible evidence agent
```

The redesign will preserve the existing React, FastAPI, deterministic-rule, RAG, and confirm-gated action behavior while introducing:

- A compact, metrics-first visual hierarchy.
- Real routes for Leitstand, exceptions, documents, actions, and analysis runs.
- A conditional selected-finding timeline beneath the exception queue.
- Strict semantic color separation: red for critical conditions, deep ink navy for actions.
- A persistent collapsible navigation sidebar.
- A persistent collapsible agent sidebar.
- Visually separate user-message and agent-response surfaces.
- Collapsed RAG citations that reveal one validated source excerpt at a time.
- A small read-only API extension for structured citation metadata.

No rule evaluation, severity ownership, database schema, or external-action safety boundary will change.

## Implementation Changes

### 1. Establish the application shell and design system

- Start the implementation branch from `origin/agentic-deepseek-composio`, not the four-commit-behind local `master`.
- Replace the centered `max-w-7xl` page shell with a full-width CSS Grid:
  - Expanded left sidebar: `224px`.
  - Collapsed left sidebar: `72px`.
  - Main workspace: `minmax(0, 1fr)`.
  - Expanded agent sidebar: `400px`.
  - Collapsed agent sidebar: `56px`.
- On desktop widths of at least `1280px`, both sidebars participate in the grid and the main canvas resizes when either sidebar is toggled.
- First-visit defaults:
  - Left navigation expanded.
  - Agent sidebar collapsed.
- Store preferences independently in local storage:
  - `rolloutguard.sidebar.navigation.collapsed`
  - `rolloutguard.sidebar.agent.collapsed`
- Read invalid or missing stored values safely and fall back to the first-visit defaults.
- Do not animate grid width or other layout properties. Switch column widths directly and animate only sidebar label opacity and transform for approximately `160ms`, respecting `prefers-reduced-motion`.
- Use semantic `aside`, `nav`, `main`, and header regions. Toggle buttons retain their DOM position and expose `aria-controls`, `aria-expanded`, and descriptive labels.
- In collapsed navigation:
  - Show the RG mark and route icons.
  - Hide text labels visually while preserving accessible names.
  - Use simple accessible tooltips or `title` labels without adding another UI dependency.
- In collapsed agent mode:
  - Show a narrow rail with an agent icon, “Agent öffnen” control, and a small neutral unread/pending indicator.
  - Do not show message previews or truncated content in the rail.
- Provide a basic narrow-window safeguard outside the desktop-first acceptance scope:
  - Below `1280px`, default the navigation to its icon width.
  - Open the agent above the workspace as a right-side overlay rather than allowing the center table to become unusably narrow.
  - Do not treat mobile layout polish as part of this iteration.

### 2. Apply the refined visual hierarchy

- Replace Jost heading usage with Geist so the product uses Geist for interface hierarchy and Geist Mono for rule IDs, coordinates, dates, and metrics. Remove the Jost import and package if no references remain.
- Convert the global palette to tinted OKLCH tokens with explicit semantic roles:
  - Warm mineral canvas and pale stone raised surfaces.
  - Deep charcoal primary text.
  - Deep ink navy for primary actions, active navigation, focus rings, and neutral selection.
  - Signal red only for critical counts, critical status, critical row tint, violated milestones, and conflicting evidence.
  - Restrained amber for warnings.
  - Muted green only for successful or connected states.
- Do not use red for “Analyse starten,” “Freigeben,” filters, navigation, or ordinary interactive states.
- Keep “Verwerfen” as a neutral outline action unless it represents an irreversible destructive operation.
- Replace oversized headings with a compact `26–30px` page title and inline supporting text.
- Make the KPI strip the first visual anchor:
  - `50 Standorte`
  - `12 kritisch`
  - `8 Warnungen`
  - `86 % im Plan`
- Render KPIs as one divided horizontal strip, not four cards.
- Use data tables and hairline dividers instead of nested card grids. Keep table rows approximately `40–44px` tall and maintain readable `14–15px` body text.
- Implement loading skeletons, useful empty states, inline errors with retry actions, and successful mutation feedback for every redesigned view.

### 3. Introduce real sidebar destinations

Use the existing APIs and query hooks to create these routes:

| Route | Sidebar label | Behavior |
|---|---|---|
| `/` | Leitstand | Compact KPIs, prioritized findings, pending-action summary, and latest-run context |
| `/ausnahmen` | Ausnahmen | Full searchable and sortable exception queue |
| `/dokumente` | Dokumente | Document list, upload/drop area, extraction status, and associated site IDs |
| `/aktionen` | Aktionen | Draft, confirmed, dismissed, and failed actions with confirmation controls |
| `/laeufe` | Läufe | Analysis history, active-run selection, KPI comparison, and run diff |
| `/befund/:id` | No separate sidebar item | Full finding inspector retained for deep links and detailed review |

- Reuse data-fetching hooks rather than letting pages issue duplicate requests.
- Move the action list query and confirm/dismiss mutations out of `ActionsQueue` into a reusable hook exposed through the workbench context. This allows the Leitstand, action page, navigation indicators, and agent sidebar to share one cache.
- Keep the current `/befund/:id` route working for compatibility.
- On the Leitstand and `/ausnahmen`, selecting a table row will:
  - Store the selected finding as `?befund=<id>` so it can be shared and restored.
  - Keep the queue visible.
  - Display the selected finding’s compact timeline directly below the table.
  - Offer a secondary “Details öffnen” link to `/befund/:id`.
- Selection itself uses a neutral ink treatment. Critical red appears only because the selected record is critical, not merely because it is selected.

### 4. Make the timeline explicitly conditional

- Extract the timeline query and presentation into a reusable selected-finding component.
- Render no timeline when no finding is selected.
- When selected, show:
  - `Projektverlauf · <site_id>`
  - Neutral badge `Ausgewählte Ausnahme`
  - Collapse control at the far right
  - Milestones and source coordinates
  - A concise deterministic-rule violation summary
- Connect the table and timeline through the selected site ID and neutral alignment, not a colored side stripe.
- Use red only on the violated milestone, critical date, and critical rule summary.
- Show a timeline skeleton while loading and an inline retry state on failure.
- If a finding has no meaningful milestone data, show a compact facts/evidence summary instead of an empty timeline.
- Timeline collapse state is local to the page and does not need cross-visit persistence.

### 5. Replace the floating agent popover with a collapsible sidebar

- Replace `AgentDock` with a persistent `AgentSidebar` mounted in the application shell so it survives route navigation.
- Expanded structure:
  - Compact header with “Evidenz-Copilot,” current analysis run, grounded status, and collapse control.
  - Scrollable conversation transcript.
  - Sticky composer at the bottom.
- Do not automatically open the agent when a finding is selected.
- Opening and closing the agent must not clear its current transcript or draft input.
- Preserve separate transcript state per analysis run during the active browser session so switching runs does not mix answers from different analyses.
- Reload persistence for the full transcript is out of scope; only sidebar expansion preferences persist across visits.

#### Message separation

Represent each agent turn with separate visual surfaces:

- User message:
  - Right-aligned box with a low-chroma ink tint.
  - Label `Sie`.
  - Maximum width around `85%`.
  - Preserve whitespace and line wrapping.
- Agent response:
  - Left-aligned neutral surface below the user message.
  - Label `Evidenz-Copilot`.
  - Answer, citations, proposed actions, and secondary metadata belong to this response block.
  - Do not wrap both the user and agent message inside one shared card.
- Use `12–16px` spacing between the user box and the corresponding agent response, with a larger divider between complete turns.

Update the frontend turn model to support asynchronous rendering:

```ts
type AgentTurn = {
  id: string
  analysisRunId: number
  question: string
  status: 'pending' | 'complete' | 'error'
  result?: AgentResult
}
```

Submission behavior:

1. Append the user message immediately as a pending turn.
2. Clear the composer after accepting the submission.
3. Render an agent skeleton beneath that message.
4. Replace the skeleton with the response on success.
5. On failure, render an inline error under the same user message with a retry action that resubmits the exact question.
6. Prevent duplicate submissions while that turn is pending.
7. Announce completed answers through a polite live region without moving keyboard focus.

Additional disclosure rules:

- Show suggested questions only in the empty transcript state or behind a compact “Beispielfragen” disclosure.
- Keep tool traces collapsed under `Verwendete Werkzeuge (<count>)`.
- Keep memory identifiers out of the primary reading flow; show them only inside citation details or a technical disclosure.
- If the agent produces proposed-action IDs, resolve them through the shared actions query and display a compact pending-action preview beneath the relevant answer.
- `Freigeben` remains deep ink navy and calls only the existing confirmation endpoint.
- State clearly: `Keine externe Aktion wird ohne Freigabe ausgeführt.`

### 6. Add progressive RAG citations

Extend the assistant response with server-validated citation details rather than asking the UI to interpret opaque IDs.

Add an optional, backward-compatible field to `AgentAnswer` and the TypeScript `AgentResult`:

```ts
type AgentCitation = {
  id: string
  sourceKind: 'workbook_cell' | 'document_chunk'
  label: string
  locator: string
  snippet: string | null
  evidenceId: string | null
  documentId: number | null
}
```

Backend resolution rules:

- Continue returning the existing `evidence_ids` and `memory_ids`.
- Resolve citation metadata after the agent finishes, using database records rather than trusting labels or snippets produced by the model.
- For workbook evidence:
  - Verify the evidence belongs to the requested analysis run.
  - Use the source filename as `label`.
  - Build `locator` from sheet, row, and column.
  - Use the stored cell value as the concise snippet when appropriate.
- For document chunks:
  - Strictly parse IDs in the form `doc:<document_id>#c<chunk_index>`.
  - Verify the document belongs to the analysis run’s project.
  - Use the filename as `label`.
  - Use `Abschnitt <n>` as the locator because the current chunk model does not preserve PDF page numbers.
  - Return a server-truncated excerpt of at most 280 characters.
- Deduplicate citations while preserving first-use order and cap the response at 12 citations.
- Silently omit invalid, unknown, or cross-project citation IDs.
- Persist normalized citation data in the existing `AgentMessage.citation_json`.
- Do not add database columns or migrations.

Frontend citation behavior:

- Show citation count and collapsed citation rows beneath each agent answer.
- Each row displays source label and locator with a right-facing chevron.
- Only one citation may be expanded at a time within a response.
- Expanding a row reveals the stored snippet and source identifier.
- Collapsing it returns to the compact citation list.
- Evidence selection may still highlight the corresponding finding source cell when an `evidenceId` exists.
- Document citations may link to `/dokumente` with the relevant document selected.
- If no validated citations are returned, show `Keine überprüfbare Quelle in dieser Antwort` rather than rendering raw model-generated IDs as trusted evidence.

## Public Interfaces and Dependencies

- `POST /api/assistant/queries` gains `result.citations`; all existing response fields remain unchanged.
- No write endpoint, rule interface, action-confirmation contract, or persistence schema changes.
- Reuse the feature branch’s existing stack:
  - React 19
  - TypeScript 6
  - Vite 8
  - Tailwind CSS 4
  - TanStack Query 5
  - React Router 7
  - Geist and Geist Mono
  - Lucide React
  - CVA, `clsx`, and `tailwind-merge`
  - Sonner
- Do not add Framer Motion, Redux, Zustand, a data-grid package, or a charting package.
- Implement sidebar disclosure and citation accordion behavior with React state, semantic buttons, ARIA relationships, and the existing icon set.
- Add frontend test tooling only:
  - Vitest
  - React Testing Library
  - `@testing-library/user-event`
  - `@testing-library/jest-dom`
  - jsdom

## Test and Acceptance Plan

### Backend tests

- Mock-agent response includes structured workbook citations with correct file, sheet, row, column, and value.
- Document memory IDs resolve to the correct filename, section number, and truncated snippet.
- Duplicate IDs produce one citation in first-use order.
- Invalid citation IDs are omitted.
- A citation referencing another project’s document is omitted.
- Citation count is capped at 12.
- Deterministic mock mode still returns usable citation metadata.
- Existing `evidence_ids`, `memory_ids`, and action IDs remain backward-compatible.
- Full backend suite and Ruff pass:

```powershell
cd backend
uv run ruff check src tests
uv run pytest
```

### Frontend component tests

- First visit shows expanded navigation and collapsed agent.
- Each panel toggles independently.
- Both preferences restore correctly from local storage.
- Invalid local-storage values restore defaults.
- Desktop grid releases space to the main canvas when a panel collapses.
- Every sidebar route has the correct active state and renders its intended view.
- Collapsed navigation controls retain accessible names.
- Agent collapse does not clear the transcript or draft input.
- User messages and agent responses are separate DOM regions with `Sie` and `Evidenz-Copilot` labels.
- A pending question immediately renders the user box and agent skeleton.
- Success replaces the skeleton with the response.
- Failure renders retry beneath the matching user message.
- Agent turns from different analysis runs do not mix.
- Citations begin collapsed.
- Expanding one citation collapses the previously expanded citation.
- Invalid or absent citations display the unverified-source fallback.
- Proposed actions remain drafts until the explicit confirm button is activated.
- The timeline does not render without a selected finding.
- Selecting a finding updates the URL and renders the correct timeline.
- Collapsing the timeline does not clear table selection.
- Primary actions use the action token; critical red is absent from ordinary action buttons.

### Build and visual acceptance

```powershell
cd frontend
npm run test
npm run lint
npm run build
```

Manually verify at `1440×900` and `1920×1080`:

- The queue remains the dominant surface.
- The compact title does not push KPIs or data below the fold unnecessarily.
- Red appears only on critical/error semantics.
- Both expanded sidebars leave the center workspace usable.
- Collapsing either sidebar visibly returns width to the main workspace.
- Keyboard users can reach, toggle, and operate both sidebars, route navigation, citation disclosures, timeline disclosure, and action confirmation.
- Focus indicators remain visible on all warm-neutral surfaces.
- Long questions, long answers, 12 citations, no citations, long German filenames, and multiple proposed actions do not overflow.
- The interface remains operational in deterministic mock mode with Composio disconnected.

## Assumptions and Defaults

- The implementation targets a new working branch based on `origin/agentic-deepseek-composio`.
- Desktop widths of `1280px` and above are the primary acceptance target.
- Polished tablet and mobile layouts are deferred; a safe narrow-window fallback is still required.
- The left sidebar is expanded on first visit.
- The agent sidebar is collapsed on first visit.
- Both sidebars resize the desktop canvas and remember their state locally.
- Navigation destinations are real routes, not decorative or in-page-only controls.
- The selected timeline is conditional and URL-addressable.
- User input and agent output are always separate visual blocks.
- Citation excerpts come only from server-validated stored evidence.
- Document citations use chunk/section locators until ingestion preserves page-level PDF metadata.
- Full transcript restoration after a browser reload is not included in this iteration.
- No external action executes without the existing explicit confirmation endpoint.
