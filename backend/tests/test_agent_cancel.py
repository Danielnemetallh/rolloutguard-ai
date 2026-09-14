"""Cancellation of in-flight assistant queries."""

from __future__ import annotations

import threading
import time

from fastapi.testclient import TestClient

from rolloutguard_api.ai.agent import question_wants_composio, run_agent, tools_for_question
from rolloutguard_api.ai.cancel import AgentCancelled, cancel_inflight, register_inflight
from rolloutguard_api.ai.memory import new_session_id
from rolloutguard_api.ai.provider import LLMProvider, LLMResponse
from rolloutguard_api.ai.tools import TOOL_SPECS
from rolloutguard_api.main import create_app


class SlowToolProvider(LLMProvider):
    name = "slow-cancel-test"

    def __init__(self) -> None:
        self.calls = 0
        self.started = threading.Event()
        self.second_started = threading.Event()

    def complete(
        self,
        messages,
        *,
        tools=None,
        temperature=0.0,
        max_tokens=1200,
        thinking=False,
    ) -> LLMResponse:
        from rolloutguard_api.ai.cancel import raise_if_cancelled

        self.calls += 1
        self.started.set()
        if self.calls == 1:
            return LLMResponse(
                content="",
                model=self.name,
                latency_ms=1,
                tool_calls=[
                    {
                        "id": "call_slow",
                        "type": "function",
                        "function": {
                            "name": "list_findings",
                            "arguments": '{"limit": 3}',
                        },
                    }
                ],
            )
        self.second_started.set()
        for _ in range(80):
            raise_if_cancelled()
            time.sleep(0.05)
        return LLMResponse(
            content='{"answer": "too late", "site_ids": [], "evidence_ids": []}',
            model=self.name,
            latency_ms=1,
        )


def _analysis_id() -> int:
    client = TestClient(create_app())
    project_id = client.get("/api/projects").json()[0]["id"]
    return client.post(f"/api/projects/{project_id}/analyze-synthetic").json()["analysis_run_id"]


def test_explain_question_does_not_offer_composio_tools() -> None:
    names = {
        spec["function"]["name"]
        for spec in tools_for_question("Erkläre mir diesen Befund")
        if isinstance(spec, dict)
    }
    assert "list_findings" in names
    assert "NOTION_UPDATE_PAGE" not in names
    assert "GMAIL_CREATE_EMAIL_DRAFT" not in names
    assert tools_for_question(
        "Erkläre diesen Befund",
        viewport={"selected_finding": {"site_id": "DE-NRW-0107", "rule_id": "SLA-001"}},
    ) == []
    assert not question_wants_composio("Erkläre mir diesen Befund")
    assert question_wants_composio("Schreibe DE-NRW-0107 in Notion")
    notion_names = {
        spec["function"]["name"]
        for spec in tools_for_question("Schreibe DE-NRW-0107 in Notion")
        if isinstance(spec, dict)
    }
    assert "NOTION_UPDATE_PAGE" in notion_names
    assert len(tools_for_question("Welche Quelle belegt das?")) == len(TOOL_SPECS)


def test_run_agent_stops_on_cancel_event() -> None:
    analysis_id = _analysis_id()
    provider = SlowToolProvider()
    cancel = threading.Event()
    caught: list[BaseException] = []

    def worker() -> None:
        from rolloutguard_api.db.session import SessionLocal

        db = SessionLocal()
        try:
            run_agent(
                db,
                analysis_run_id=analysis_id,
                session_id=new_session_id(),
                question="Erkläre mir diesen Befund",
                provider=provider,
                cancel_event=cancel,
            )
        except AgentCancelled as exc:
            caught.append(exc)
        finally:
            db.close()

    thread = threading.Thread(target=worker)
    thread.start()
    assert provider.started.wait(timeout=2)
    assert provider.second_started.wait(timeout=2)
    cancel.set()
    thread.join(timeout=2)
    assert not thread.is_alive()
    assert caught
    assert provider.calls == 2


def test_cancel_endpoint_stops_hanging_query(monkeypatch) -> None:
    analysis_id = _analysis_id()
    provider = SlowToolProvider()
    monkeypatch.setattr(
        "rolloutguard_api.api.assistant.get_llm_provider",
        lambda force_mock=False: provider,
    )
    client = TestClient(create_app())
    request_id = "cancel-test-request"
    errors: list[BaseException] = []
    responses: list[object] = []

    def worker() -> None:
        try:
            responses.append(
                client.post(
                    "/api/assistant/queries",
                    json={
                        "analysis_run_id": analysis_id,
                        "question": "Erkläre mir diesen Befund",
                        "client_request_id": request_id,
                    },
                )
            )
        except BaseException as exc:  # noqa: BLE001
            errors.append(exc)

    thread = threading.Thread(target=worker)
    thread.start()
    assert provider.started.wait(timeout=3)
    assert provider.second_started.wait(timeout=3)
    cancelled = client.post(
        "/api/assistant/queries/cancel",
        json={"client_request_id": request_id, "analysis_run_id": analysis_id},
    )
    assert cancelled.status_code == 200
    assert cancelled.json()["cancelled"] >= 1
    thread.join(timeout=3)
    assert not thread.is_alive()
    assert not errors
    assert responses
    assert responses[0].status_code == 499  # type: ignore[union-attr]
    assert provider.calls == 2


def test_cancel_inflight_registry() -> None:
    event = threading.Event()
    key = register_inflight(event, analysis_run_id=42, client_request_id="abc")
    assert key == "abc"
    assert cancel_inflight(client_request_id="abc") == 1
    assert event.is_set()
    assert cancel_inflight(client_request_id="missing") == 0
