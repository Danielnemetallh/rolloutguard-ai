"""Golden evaluations for prompts / agent using the deterministic mock."""

from __future__ import annotations

from fastapi.testclient import TestClient

from rolloutguard_api.ai.agent import run_agent
from rolloutguard_api.ai.enrichment import classify_blocker, explain_finding
from rolloutguard_api.ai.provider import MockLLMProvider, extract_json_object
from rolloutguard_api.main import create_app


def test_extract_json_from_fenced_noise() -> None:
    text = 'Sure!\n```json\n{"a": 1, "b": "x"}\n```\n'
    assert extract_json_object(text) == {"a": 1, "b": "x"}


def test_explain_finding_mock_grounds_evidence() -> None:
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
        provider=MockLLMProvider(),
    )
    assert result.abstained is False
    assert result.evidence_ids
    assert set(result.evidence_ids) <= {"E-CONTRACT-1", "E-SCHEDULE-2"}


def test_explain_abstains_on_insufficient_marker() -> None:
    result = explain_finding(
        rule_id="DQ-003",
        severity="warning",
        message="Ambiguous date — abstain please insufficient evidence",
        facts={},
        evidence=[],
        provider=MockLLMProvider(),
    )
    assert result.abstained is True


def test_explain_fallback_when_llm_raises() -> None:
    class BrokenProvider(MockLLMProvider):
        def complete_json(self, messages, *, temperature=0.0):
            raise ValueError("simulated provider failure")

    evidence = [
        {
            "evidence_id": "E-SCHEDULE-1",
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
        facts={"forecast_date": "2026-09-20"},
        evidence=evidence,
        provider=BrokenProvider(),
    )
    assert result.abstained is False
    assert "E-SCHEDULE-1" in result.evidence_ids
    assert "Forecast liegt nach" in result.summary


def test_blocker_classification_backhaul() -> None:
    out = classify_blocker(
        "Backhaul handover moved by supplier",
        provider=MockLLMProvider(),
    )
    assert out["blocker_category"] == "BACKHAUL_READINESS"
    assert out["abstained"] is False


def _run_agent_on_synthetic(question: str):
    client = TestClient(create_app())
    projects = client.get("/api/projects").json()
    project_id = projects[0]["id"]
    analysis = client.post(f"/api/projects/{project_id}/analyze-synthetic").json()
    analysis_id = analysis["analysis_run_id"]

    from rolloutguard_api.db.session import SessionLocal

    db = SessionLocal()
    try:
        return run_agent(
            db,
            analysis_run_id=analysis_id,
            question=question,
            provider=MockLLMProvider(),
        )
    finally:
        db.close()


def test_agent_answers_critical_sites() -> None:
    answer = _run_agent_on_synthetic(
        "Welche drei Standorte gefährden das September-Integrationsziel — und warum?",
    )
    assert answer.abstained is False
    assert answer.site_ids or "DE-" in answer.answer
    assert "list_findings" in answer.tool_trace


def test_agent_chip_lists_critical_findings() -> None:
    answer = _run_agent_on_synthetic("Liste alle kritischen Befunde dieses Laufs.")
    assert "list_findings" in answer.tool_trace


def test_agent_chip_loads_site_timeline() -> None:
    answer = _run_agent_on_synthetic("Zeige die Timeline für DE-NRW-0107.")
    assert "get_site_timeline" in answer.tool_trace


def test_agent_generic_question_uses_kpis() -> None:
    answer = _run_agent_on_synthetic("Wie viele Standorte sind im Portfolio?")
    assert "get_portfolio_kpis" in answer.tool_trace
