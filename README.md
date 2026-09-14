# RolloutGuard AI

Evidence-linked Excel reconciliation and milestone compliance for **synthetic**
mobile-network rollout data.

> Independent prototype. Fictional partners, sites, and rules.
> Not affiliated with or commissioned by any telecommunications operator.

## Stack

| Layer | Choice |
|---|---|
| Frontend | React + TypeScript + Vite + TanStack Query |
| Backend | Python 3.12 + FastAPI + Pydantic + SQLAlchemy |
| Database | SQLite (local demo) or Neon PostgreSQL |
| Excel | openpyxl + Polars |
| Documents | pypdf + python-docx |
| AI | DeepSeek API + deterministic mock |
| Integrations | Composio (Gmail draft, Calendar, Notion) after Freigeben |

## Prerequisites

- Python 3.12+ via [uv](https://github.com/astral-sh/uv)
- Node.js 20+

## Quick start

1. Copy env (SQLite works offline out of the box; set Neon URL only if needed):

```powershell
Copy-Item .env.example .env
```

2. Install dependencies (first time only):

```powershell
cd backend; uv sync
cd ..\frontend; npm ci
```

3. Backend:

```powershell
.\scripts\dev-api.ps1
```

4. Frontend (separate terminal):

```powershell
.\scripts\dev-web.ps1
```

5. Open http://localhost:5173 — API docs at http://127.0.0.1:8001/docs

The demo UI is in **German**; API paths and rule IDs stay English.

**Demo reset:** `.\scripts\demo-reset.ps1`

Set `DEEPSEEK_API_KEY` and `LLM_ENABLED=true` for live explanations. Set
`COMPOSIO_API_KEY` and connect Gmail / Calendar / Notion for the interview path.
Without Composio, Freigeben writes `.eml` / `.ics` under `data/uploads/actions/`
(CI / offline).

## Scope / non-goals

**In scope:** multi-workbook import, PDF/DOCX ingest, column mapping, reconciliation,
versioned deterministic rules, findings with cell-level lineage, KPIs, human review,
run history/diff, grounded AI explanations, allowlisted agent (read / retrieve /
extract / draft), confirm-gated Calendar/Gmail/Notion, Excel export, tests.

**Out of scope:** real operator data, silent writeback, custom model training,
containers, swapping the agent loop for a third-party harness.

## Project layout

```
backend/          FastAPI application (uv)
frontend/         React UI (Vite)
data/synthetic/   Generated demo workbooks + docs
data/uploads/     Runtime uploads (gitignored)
scripts/          Local run helpers (no Docker)
```

## Tests

```powershell
cd backend
uv run pytest
uv run ruff check src tests
```

Live DeepSeek smoke (optional, uses `.env` key):

```powershell
uv run pytest tests/test_live_llm_smoke.py -q
```

## AI layer

- Deterministic mock is always available (`force_mock` / `LLM_ENABLED=false`)
- Live provider: DeepSeek OpenAI-compatible API (`deepseek-v4-flash`)
- The model drafts only. `POST /api/actions/{id}/confirm` is the only path to Composio.
- Agent tools: KPIs, findings, timeline, rules, session/decision/corpus memory,
  document extract, draft calendar/mail/board/override/watch/task

## Export

```http
POST /api/analyses/{id}/exports
```

Writes sanitized files under `data/uploads/exports/`.
