"""Composio tool hook: auto-run reads, pause writes for permission."""

from __future__ import annotations

from fastapi.testclient import TestClient

from rolloutguard_api.ai.composio_hooks import policy_for, run_composio_hook
from rolloutguard_api.ai.memory import new_session_id
from rolloutguard_api.ai.provider import MockLLMProvider
from rolloutguard_api.main import create_app


def test_policy_auto_vs_ask_vs_block() -> None:
    assert policy_for("GOOGLECALENDAR_LIST_EVENTS") == "auto"
    assert policy_for("GMAIL_CREATE_EMAIL_DRAFT") == "ask"
    assert policy_for("GOOGLECALENDAR_DELETE_EVENT") == "ask"
    assert policy_for("GMAIL_SEND_EMAIL") == "block"
    assert policy_for("SOME_UNKNOWN_TOOL") == "block"


def test_write_tool_pauses_for_permission() -> None:
    client = TestClient(create_app())
    project_id = client.get("/api/projects").json()[0]["id"]
    analysis_id = client.post(f"/api/projects/{project_id}/analyze-synthetic").json()[
        "analysis_run_id"
    ]
    from rolloutguard_api.db.session import SessionLocal

    db = SessionLocal()
    try:
        result = run_composio_hook(
            db,
            name="GOOGLECALENDAR_CREATE_EVENT",
            arguments={
                "summary": "SLA DE-NRW-0107",
                "start_datetime": "2026-09-20",
                "site_id": "DE-NRW-0107",
            },
            analysis_run_id=analysis_id,
        )
        assert result["status"] == "pending_permission"
        assert isinstance(result["proposed_action_id"], int)
    finally:
        db.close()


def test_blocked_tool_is_rejected() -> None:
    client = TestClient(create_app())
    project_id = client.get("/api/projects").json()[0]["id"]
    analysis_id = client.post(f"/api/projects/{project_id}/analyze-synthetic").json()[
        "analysis_run_id"
    ]
    from rolloutguard_api.db.session import SessionLocal

    db = SessionLocal()
    try:
        result = run_composio_hook(
            db,
            name="GMAIL_DELETE_MESSAGE",
            arguments={},
            analysis_run_id=analysis_id,
        )
        assert result["error"] == "tool_blocked"
    finally:
        db.close()


def test_agent_lists_calendar_through_composio_tool() -> None:
    client = TestClient(create_app())
    project_id = client.get("/api/projects").json()[0]["id"]
    analysis_id = client.post(f"/api/projects/{project_id}/analyze-synthetic").json()[
        "analysis_run_id"
    ]
    from rolloutguard_api.ai.agent import run_agent
    from rolloutguard_api.db.session import SessionLocal

    db = SessionLocal()
    try:
        answer = run_agent(
            db,
            analysis_run_id=analysis_id,
            session_id=new_session_id(),
            question="Hey, welche Termine habe ich im Kalender stehen?",
            provider=MockLLMProvider(),
        )
        assert "GOOGLECALENDAR_LIST_EVENTS" in answer.tool_trace
    finally:
        db.close()
