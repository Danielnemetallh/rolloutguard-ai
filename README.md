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
| Database | Neon PostgreSQL (no Docker) |
| Excel | openpyxl + Polars |
| AI | OpenCode Zen (OpenAI-compatible) + deterministic mock |

## Prerequisites

- Python 3.12+ via [uv](https://github.com/astral-sh/uv)
- Node.js 20+
- A free [Neon](https://neon.tech) Postgres project

## Quick start

1. Copy env and set your Neon connection string:

```powershell
Copy-Item .env.example .env
# Edit .env → DATABASE_URL=postgresql+psycopg2://...@...neon.tech/neondb?sslmode=require
```

2. Backend:

```powershell
.\scripts\dev-api.ps1
```

3. Frontend (separate terminal):

```powershell
.\scripts\dev-web.ps1
```

4. Open http://localhost:5173 — API docs at http://127.0.0.1:8000/docs

## Scope / non-goals

**In scope:** multi-workbook import, column mapping, reconciliation, versioned
deterministic rules, findings with cell-level lineage, KPIs, human review,
grounded AI explanations, read-only agent, Excel export, tests.

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

```http
POST /api/analyses/{id}/exports
```

Writes sanitized `.xlsx` + `.md` under `data/uploads/exports/`.
