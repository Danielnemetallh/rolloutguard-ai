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

The demo UI is in **German**; API paths and rule IDs stay English.

**Demo reset:** `.\scripts\demo-reset.ps1`

The reset regenerates synthetic workbooks and removes only local runtime state
(SQLite files plus incoming, batch, and export directories). Source workbooks,
fixtures, scripts, and tests are preserved.

## Demo workflow

1. Run `.\scripts\demo-reset.ps1` when a clean local state is needed.
2. Start the API and frontend with the commands above.
3. Click **Analyse starten** in the Leitstand.
4. Filter or search the exception queue and open a finding.
5. Inspect the source cells and site timeline.
6. Use **KI erklären** or ask the read-only agent about the selected run.
7. Confirm **Freigeben** or **Verwerfen** through the two-step review control.
8. Use **Export** to create the sanitized `.xlsx` and `.md` output.

The current master frontend exposes the Leitstand at `/` and finding details at
`/befund/:id`. The deterministic mock agent is available offline when
`LLM_ENABLED=false`; no external provider is required for the demo.

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
data/fixtures/    Derived, attributed test fixtures (synthetic assumptions)
data/uploads/     Runtime uploads (gitignored)
scripts/          Local run helpers (no Docker)
```

## Tests

```powershell
cd backend
uv run pytest --basetemp <writable-task-temp>
uv run ruff check src tests
```

The Kaggle-derived fixture can be checked independently with:

```powershell
uv run pytest tests/test_kaggle_fixture.py tests/test_api_analysis.py -q --basetemp <writable-task-temp>
```

The fixture files under `data/fixtures/kaggle_construction/` are derived from
the attributed Kaggle source data. Project IDs are converted to stable fixture
site IDs, while dates, partner assignments, contractual values, and status
values are explicit assumptions for exercising mapping and reconciliation. They
must not be interpreted as facts from the source dataset.

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
