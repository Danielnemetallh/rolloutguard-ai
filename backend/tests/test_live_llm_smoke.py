"""Optional live smoke test against DeepSeek (skipped without key)."""

from __future__ import annotations

import os
from pathlib import Path

import pytest
from dotenv import load_dotenv

REPO_ROOT = Path(__file__).resolve().parents[2]
load_dotenv(REPO_ROOT / ".env")


@pytest.mark.skipif(
    not os.getenv("DEEPSEEK_API_KEY") or os.getenv("SKIP_LIVE_LLM") == "1",
    reason="No DeepSeek API key configured",
)
def test_live_deepseek_json_smoke() -> None:
    from rolloutguard_api.ai.provider import DeepSeekProvider, extract_json_object

    provider = DeepSeekProvider(
        api_key=os.environ["DEEPSEEK_API_KEY"],
        base_url=os.getenv("DEEPSEEK_BASE_URL", "https://api.deepseek.com"),
        model=os.getenv("DEEPSEEK_MODEL", "deepseek-v4-flash"),
        timeout_s=120.0,
    )
    response = provider.complete(
        [
            {
                "role": "system",
                "content": 'Reply with JSON only: {"ok": true, "echo": "<word>"}',
            },
            {"role": "user", "content": "word=rolloutguard"},
        ],
        temperature=0.0,
        max_tokens=800,
        thinking=False,
    )
    assert response.content, "DeepSeek returned empty content"
    data = extract_json_object(response.content)
    assert data.get("ok") is True
    echo = str(data.get("echo", "")).lower()
    assert "rollout" in echo


@pytest.mark.skipif(
    not os.getenv("DEEPSEEK_API_KEY") or os.getenv("SKIP_LIVE_LLM") == "1",
    reason="No DeepSeek API key configured",
)
def test_live_explain_finding_deepseek() -> None:
    from rolloutguard_api.ai.enrichment import explain_finding
    from rolloutguard_api.ai.provider import DeepSeekProvider

    provider = DeepSeekProvider(
        api_key=os.environ["DEEPSEEK_API_KEY"],
        base_url=os.getenv("DEEPSEEK_BASE_URL", "https://api.deepseek.com"),
        model=os.getenv("DEEPSEEK_MODEL", "deepseek-v4-flash"),
        timeout_s=120.0,
    )
    evidence = [
        {
            "evidence_id": "E-CONTRACT-1",
            "file": "contract_obligations.xlsx",
            "sheet": "Obligations",
            "row": 2,
            "column": "Vertragsfälligkeit",
            "value": "15.09.2026",
        },
        {
            "evidence_id": "E-SCHEDULE-2",
            "file": "partner_schedule.xlsx",
            "sheet": "Milestones",
            "row": 2,
            "column": "Forecast Date",
            "value": "2026-09-20",
        },
    ]
    result = explain_finding(
        rule_id="SLA-001",
        severity="critical",
        message="Forecast liegt nach der vertraglichen Fälligkeit.",
        facts={"forecast_date": "2026-09-20", "contractual_due_date": "2026-09-15"},
        evidence=evidence,
        blocker_comment="Backhaul handover moved by supplier",
        provider=provider,
    )
    assert result.summary
    if not result.abstained:
        assert set(result.evidence_ids) <= {"E-CONTRACT-1", "E-SCHEDULE-2"}
