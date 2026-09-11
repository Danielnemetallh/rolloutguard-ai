"""Agent chat sessions are isolated from analysis-run history."""

from __future__ import annotations

from fastapi.testclient import TestClient

from rolloutguard_api.ai.memory import persist_agent_turn, recall_session
from rolloutguard_api.main import create_app


def _analysis_id(client: TestClient) -> int:
    project_id = client.get("/api/projects").json()[0]["id"]
    return client.post(f"/api/projects/{project_id}/analyze-synthetic").json()[
        "analysis_run_id"
    ]


def test_new_session_does_not_recall_previous_turns() -> None:
    client = TestClient(create_app())
    analysis_id = _analysis_id(client)

    first_session = client.post(
        "/api/assistant/sessions",
        json={"analysis_run_id": analysis_id},
    ).json()["session_id"]
    first = client.post(
        "/api/assistant/queries",
        json={
            "analysis_run_id": analysis_id,
            "session_id": first_session,
            "question": "Liste alle kritischen Befunde dieses Laufs.",
            "force_mock": True,
        },
    )
    assert first.status_code == 200, first.text
    assert first.json()["session_id"] == first_session

    new_session = client.post(
        "/api/assistant/sessions",
        json={"analysis_run_id": analysis_id},
    ).json()["session_id"]
    assert new_session != first_session

    second = client.post(
        "/api/assistant/queries",
        json={
            "analysis_run_id": analysis_id,
            "session_id": new_session,
            "question": "Wie viele Standorte sind im Portfolio?",
            "force_mock": True,
        },
    )
    assert second.status_code == 200, second.text
    assert second.json()["session_id"] == new_session

    listed = client.get("/api/assistant/sessions", params={"analysis_run_id": analysis_id})
    assert listed.status_code == 200
    session_ids = [item["session_id"] for item in listed.json()["sessions"]]
    assert first_session in session_ids
    assert new_session in session_ids

    resumed = client.get(f"/api/assistant/sessions/{first_session}")
    assert resumed.status_code == 200
    roles = [msg["role"] for msg in resumed.json()["messages"]]
    assert "user" in roles
    assert "assistant" in roles
    assert all(msg["content"] for msg in resumed.json()["messages"] if msg["role"] == "user")

    new_detail = client.get(f"/api/assistant/sessions/{new_session}")
    questions = [
        msg["content"]
        for msg in new_detail.json()["messages"]
        if msg["role"] == "user"
    ]
    assert "Wie viele Standorte sind im Portfolio?" in questions
    assert "Liste alle kritischen Befunde dieses Laufs." not in questions


def test_omitted_session_id_continues_latest_session() -> None:
    client = TestClient(create_app())
    analysis_id = _analysis_id(client)
    session_id = client.post(
        "/api/assistant/sessions",
        json={"analysis_run_id": analysis_id},
    ).json()["session_id"]

    first = client.post(
        "/api/assistant/queries",
        json={
            "analysis_run_id": analysis_id,
            "session_id": session_id,
            "question": "Liste alle kritischen Befunde dieses Laufs.",
            "force_mock": True,
        },
    )
    assert first.status_code == 200
    assert first.json()["session_id"] == session_id

    second = client.post(
        "/api/assistant/queries",
        json={
            "analysis_run_id": analysis_id,
            "question": "Wie viele Standorte sind im Portfolio?",
            "force_mock": True,
        },
    )
    assert second.status_code == 200
    assert second.json()["session_id"] == session_id

    detail = client.get(f"/api/assistant/sessions/{session_id}")
    user_turns = [
        msg["content"] for msg in detail.json()["messages"] if msg["role"] == "user"
    ]
    assert user_turns == [
        "Liste alle kritischen Befunde dieses Laufs.",
        "Wie viele Standorte sind im Portfolio?",
    ]


def test_session_id_cannot_cross_analysis_runs() -> None:
    client = TestClient(create_app())
    first_run = _analysis_id(client)
    created = client.post(
        "/api/assistant/queries",
        json={
            "analysis_run_id": first_run,
            "question": "Liste alle kritischen Befunde dieses Laufs.",
            "force_mock": True,
        },
    )
    assert created.status_code == 200
    session_id = created.json()["session_id"]

    from rolloutguard_api.db import models
    from rolloutguard_api.db.session import SessionLocal

    db = SessionLocal()
    try:
        original = db.get(models.AnalysisRun, first_run)
        assert original is not None
        source_batch = db.get(models.ImportBatch, original.batch_id)
        assert source_batch is not None
        other_batch = models.ImportBatch(
            project_id=source_batch.project_id,
            status="analyzed",
            input_hash="session-mismatch-test",
        )
        db.add(other_batch)
        db.flush()
        other = models.AnalysisRun(
            batch_id=other_batch.id,
            rule_set_checksum=original.rule_set_checksum,
            status="completed",
            summary_json={},
        )
        db.add(other)
        db.commit()
        db.refresh(other)
        second_run = other.id
    finally:
        db.close()

    crossed = client.post(
        "/api/assistant/queries",
        json={
            "analysis_run_id": second_run,
            "session_id": session_id,
            "question": "Wie viele Standorte sind im Portfolio?",
            "force_mock": True,
        },
    )
    assert crossed.status_code == 409


def test_session_can_be_renamed_and_deleted() -> None:
    client = TestClient(create_app())
    analysis_id = _analysis_id(client)
    session_id = client.post(
        "/api/assistant/sessions",
        json={"analysis_run_id": analysis_id},
    ).json()["session_id"]

    asked = client.post(
        "/api/assistant/queries",
        json={
            "analysis_run_id": analysis_id,
            "session_id": session_id,
            "question": "Was steht im hochgeladenen Vertrag zu DE-NRW-0107?",
            "force_mock": True,
        },
    )
    assert asked.status_code == 200, asked.text

    renamed = client.patch(
        f"/api/assistant/sessions/{session_id}",
        json={"title": "Vertrag DE-NRW-0107"},
    )
    assert renamed.status_code == 200, renamed.text
    assert renamed.json()["preview"] == "Vertrag DE-NRW-0107"

    listed = client.get("/api/assistant/sessions", params={"analysis_run_id": analysis_id})
    previews = {item["session_id"]: item["preview"] for item in listed.json()["sessions"]}
    assert previews[session_id] == "Vertrag DE-NRW-0107"

    deleted = client.delete(f"/api/assistant/sessions/{session_id}")
    assert deleted.status_code == 200, deleted.text

    missing = client.get(f"/api/assistant/sessions/{session_id}")
    assert missing.status_code == 404


def test_recall_session_is_scoped_to_session_id() -> None:
    client = TestClient(create_app())
    analysis_id = _analysis_id(client)

    from rolloutguard_api.db.session import SessionLocal

    db = SessionLocal()
    try:
        persist_agent_turn(
            db,
            analysis_run_id=analysis_id,
            session_id="11111111-1111-4111-8111-111111111111",
            role="user",
            content="old session question",
        )
        persist_agent_turn(
            db,
            analysis_run_id=analysis_id,
            session_id="22222222-2222-4222-8222-222222222222",
            role="user",
            content="new session question",
        )
        recalled = recall_session(
            db,
            analysis_id,
            session_id="22222222-2222-4222-8222-222222222222",
        )
        assert [turn["content"] for turn in recalled] == ["new session question"]
    finally:
        db.close()
