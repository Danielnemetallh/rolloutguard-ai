"""Golden evaluations for prompts / agent using the deterministic mock."""

from __future__ import annotations

from fastapi.testclient import TestClient

from rolloutguard_api.ai.agent import run_agent
from rolloutguard_api.ai.enrichment import classify_blocker, explain_finding
from rolloutguard_api.ai.memory import new_session_id
from rolloutguard_api.ai.provider import (
    MockLLMProvider,
    extract_json_object,
    get_llm_provider,
    llm_mock_reason,
)
from rolloutguard_api.core.config import get_settings
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
            session_id=new_session_id(),
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


def test_agent_searches_corpus_for_contract_question() -> None:
    answer = _run_agent_on_synthetic(
        "Was steht im hochgeladenen Vertrag zu DE-NRW-0107?"
    )
    assert "search_corpus" in answer.tool_trace
    assert answer.memory_ids or "DE-NRW-0107" in answer.answer


def test_agent_forces_trusted_analysis_run_id() -> None:
    from rolloutguard_api.ai.provider import LLMProvider, LLMResponse
    from rolloutguard_api.ai.tools import TOOL_IMPL

    captured: dict[str, object] = {}
    original = TOOL_IMPL["get_portfolio_kpis"]

    def capture(db, **kwargs):
        captured.update(kwargs)
        return original(db, **kwargs)

    TOOL_IMPL["get_portfolio_kpis"] = capture

    class WrongRunProvider(LLMProvider):
        name = "wrong-run-mock"

        def complete(
            self,
            messages,
            *,
            tools=None,
            temperature=0.0,
            max_tokens=1200,
            thinking=False,
        ):
            return LLMResponse(
                content="",
                model=self.name,
                latency_ms=1,
                tool_calls=[
                    {
                        "id": "call_wrong",
                        "type": "function",
                        "function": {
                            "name": "get_portfolio_kpis",
                            "arguments": '{"analysis_run_id": 99999}',
                        },
                    }
                ],
            )

    client = TestClient(create_app())
    projects = client.get("/api/projects").json()
    project_id = projects[0]["id"]
    analysis = client.post(f"/api/projects/{project_id}/analyze-synthetic").json()
    trusted_run = analysis["analysis_run_id"]

    from rolloutguard_api.db.session import SessionLocal

    db = SessionLocal()
    try:
        run_agent(
            db,
            analysis_run_id=trusted_run,
            session_id=new_session_id(),
            question="Portfolio KPIs?",
            provider=WrongRunProvider(),
        )
        assert captured.get("analysis_run_id") == trusted_run
    finally:
        db.close()
        TOOL_IMPL["get_portfolio_kpis"] = original


def test_agent_gmail_draft_asks_permission_via_hook() -> None:
    answer = _run_agent_on_synthetic(
        "Erstelle einen Briefing-Mailentwurf für NordTurm zu DE-NRW-0107."
    )
    assert "GMAIL_CREATE_EMAIL_DRAFT" in answer.tool_trace
    assert answer.proposed_action_ids


def test_get_llm_provider_uses_mock_when_disabled(monkeypatch) -> None:
    monkeypatch.setenv("DEEPSEEK_API_KEY", "test-key")
    monkeypatch.setenv("LLM_ENABLED", "false")
    get_settings.cache_clear()
    assert llm_mock_reason() == "llm_disabled"
    assert get_llm_provider().name == "deterministic-mock"


def test_get_llm_provider_uses_mock_without_api_key(monkeypatch) -> None:
    monkeypatch.setenv("DEEPSEEK_API_KEY", "")
    monkeypatch.setenv("LLM_ENABLED", "true")
    get_settings.cache_clear()
    assert llm_mock_reason() == "no_api_key"
    assert get_llm_provider().name == "deterministic-mock"


def test_get_llm_provider_uses_deepseek_when_configured(monkeypatch) -> None:
    monkeypatch.setenv("DEEPSEEK_API_KEY", "test-key")
    monkeypatch.setenv("LLM_ENABLED", "true")
    get_settings.cache_clear()
    assert llm_mock_reason() is None
    assert get_llm_provider().name == "deepseek"

