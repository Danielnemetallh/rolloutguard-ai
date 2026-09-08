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
| AI | OpenCode Zen (OpenAI-compatible) + deterministic mock |

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

5. Open http://localhost:5173 — API docs at http://127.0.0.1:8000/docs

**Demo reset:** `.\scripts\demo-reset.ps1`  
**Demo script:** [docs/DEMO.md](docs/DEMO.md)  
**Interview guide (DE):** [docs/INTERVIEW.md](docs/INTERVIEW.md)

## Scope / non-goals

**In scope:** multi-workbook import, column mapping, reconciliation, versioned
deterministic rules, findings with cell-level lineage, KPIs, human review,
run history/diff, grounded AI explanations, read-only agent, Excel export, tests.

**Out of scope:** real operator data, autonomous writeback, custom model
training, RAG (pgvector reserved for a later document corpus), containers,
multi-provider LLM switching.

## Project layout

```
backend/          FastAPI application (uv)
frontend/         React UI (Vite)
data/synthetic/   Generated demo workbooks
data/uploads/     Runtime uploads (gitignored)
scripts/          Local run helpers (no Docker)
docs/             Demo + interview guides
```

## Tests

```powershell
cd backend
uv run pytest
uv run ruff check src tests
```

Live OpenCode Zen smoke (optional, uses `.env` key):

```powershell
uv run pytest tests/test_live_llm_smoke.py -q
```

## AI layer

- Deterministic mock is always available (`force_mock` / `LLM_ENABLED=false`)
- Live provider: OpenCode Zen OpenAI-compatible API
- Endpoints:
  - `POST /api/findings/{id}/explain`
  - `POST /api/assistant/queries`
  - `POST /api/assistant/classify-blocker`
  - `GET /api/assistant/status`
- Agent tools (read-only): portfolio KPIs, list findings, site timeline, rule definition

## Export

Use the **Export (.xlsx + .md)** button in the UI, or:

```http
POST /api/analyses/{id}/exports
```

Writes sanitized files under `data/uploads/exports/`.
