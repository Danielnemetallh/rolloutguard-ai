# Repository Guidelines

RolloutGuard AI reconciles three Excel workbooks (contract, schedule, site status) into an evidence-linked exception queue. **Deterministic rules own severity**; the LLM only explains findings and answers read-only agent questions. Synthetic demo data only — no real operator data, no writeback, no containers.

## Project Structure & Module Organization

- `backend/src/rolloutguard_api/` — FastAPI app. Pipeline: `services/ingest.py` → `normalize.py` → `reconcile.py` → `rules.py` → `analysis.py`. AI lives in `ai/` (provider, enrichment, 4-tool agent). Domain schema + synthetic generator in `domain/`.
- `frontend/src/` — React + TanStack Query workbench (German demo UI): `pages/Leitstand.tsx` (queue), `pages/FindingPage.tsx` (`/befund/:id`), state in `context/WorkbenchContext.tsx` + `hooks/`. Vite proxies `/api` to the backend.
- `data/synthetic/` — checked-in demo workbooks + anomaly manifest; `data/uploads/` is runtime-only (gitignored).
- `scripts/` — PowerShell local runners (`dev-api.ps1`, `dev-web.ps1`, `generate-synthetic.ps1`, `demo-reset.ps1`).
- Root `.env` (from `.env.example`) is loaded by `scripts/dev-api.ps1`. SQLite works offline; Neon Postgres is preferred for shared demos.

## Build, Test, and Development Commands

```powershell
Copy-Item .env.example .env
.\scripts\dev-api.ps1          # uvicorn :8000
.\scripts\dev-web.ps1          # vite :5173
.\scripts\generate-synthetic.ps1
cd backend; uv sync
uv run pytest                  # all tests
uv run pytest tests/test_rules_golden.py -q   # single file
uv run ruff check src tests
cd ..\frontend; npm ci; npm run build; npm run lint
```

CI (`.github/workflows/ci.yml`): backend `uv sync --frozen` + ruff + pytest with `LLM_ENABLED=false`; frontend `npm ci` + `npm run build`.

## Coding Style & Naming Conventions

Python 3.12, Ruff line length 100 (`E,F,I,UP,B`; `B008` ignored for FastAPI defaults), mypy `strict = true` on `rolloutguard_api`. Frontend: TypeScript + Vite; lint with `oxlint`. Prefer small service modules over fat routers; keep rule IDs (`SLA-001`, `SEQ-002`, …) stable and versioned in `services/rules.py`.

## Testing Guidelines

Pytest under `backend/tests/` with session-scoped SQLite (`conftest.py`). Golden rule coverage is `test_rules_golden.py`; AI paths must pass against `MockLLMProvider` (`test_ai_eval.py`). Live Zen smoke is optional (`tests/test_live_llm_smoke.py`); CI sets `SKIP_LIVE_LLM=1`.

## Commit & Pull Request Guidelines

History is sparse (one scaffold commit). Prefer imperative, sentence-style subjects focused on *why* (e.g. “Fix freshness as_of default so FRS-001 tracks real time”). PRs should note demo impact (synthetic re-gen, env flags) and keep secrets out of commits (`.env` is gitignored).
