"""Optional live smoke test against OpenCode Zen (skipped without key)."""

from __future__ import annotations

import os
from pathlib import Path

import pytest
from dotenv import load_dotenv

REPO_ROOT = Path(__file__).resolve().parents[2]
load_dotenv(REPO_ROOT / ".env")


@pytest.mark.skipif(
    not os.getenv("OPENCODE_API_KEY") or os.getenv("SKIP_LIVE_LLM") == "1",
    reason="No OpenCode API key configured",
)
def test_live_opencode_zen_json_smoke() -> None:
    from rolloutguard_api.ai.provider import OpenCodeZenProvider, extract_json_object

    provider = OpenCodeZenProvider(
        api_key=os.environ["OPENCODE_API_KEY"],
        base_url=os.getenv("OPENCODE_BASE_URL", "https://opencode.ai/zen/v1"),
        model=os.getenv("OPENCODE_MODEL", "deepseek-v4-flash-free"),
        reasoning_effort=os.getenv("OPENCODE_REASONING_EFFORT", "medium"),
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
    )
    assert response.content, "Zen returned empty content"
    data = extract_json_object(response.content)
    assert data.get("ok") is True
    echo = str(data.get("echo", "")).lower()
    assert "rollout" in echo

    # Confirm thinking/reasoning path produced some internal reasoning when enabled
    msg = (response.raw or {}).get("choices", [{}])[0].get("message", {})
    reasoning = msg.get("reasoning_content") or msg.get("reasoning") or ""
    assert isinstance(reasoning, str)
    # Medium effort should usually produce reasoning_content on DeepSeek free
    assert len(reasoning) > 0, "Expected reasoning_content with medium thinking"


@pytest.mark.skipif(
    not os.getenv("OPENCODE_API_KEY") or os.getenv("SKIP_LIVE_LLM") == "1",
    reason="No OpenCode API key configured",
)
def test_live_explain_finding_deepseek() -> None:
    from rolloutguard_api.ai.enrichment import explain_finding
    from rolloutguard_api.ai.provider import OpenCodeZenProvider

    provider = OpenCodeZenProvider(
        api_key=os.environ["OPENCODE_API_KEY"],
        base_url=os.getenv("OPENCODE_BASE_URL", "https://opencode.ai/zen/v1"),
        model=os.getenv("OPENCODE_MODEL", "deepseek-v4-flash-free"),
        reasoning_effort=os.getenv("OPENCODE_REASONING_EFFORT", "medium"),
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
    assert result.abstained is False or result.confidence >= 0.0
    if not result.abstained:
        assert set(result.evidence_ids) <= {"E-CONTRACT-1", "E-SCHEDULE-2"}
