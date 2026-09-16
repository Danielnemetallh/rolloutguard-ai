from fastapi.testclient import TestClient

from rolloutguard_api.main import create_app


def test_confirm_without_composio_writes_eml(monkeypatch) -> None:
    from rolloutguard_api.core.config import get_settings
    from rolloutguard_api.integrations import composio_executor

    composio_executor._session_cache.clear()
    get_settings.cache_clear()
    monkeypatch.setenv("COMPOSIO_API_KEY", "")
    client = TestClient(create_app())
    projects = client.get("/api/projects").json()
    project_id = projects[0]["id"]
    analysis = client.post(f"/api/projects/{project_id}/analyze-synthetic").json()
    drafted = client.post(
        f"/api/projects/{project_id}/actions/draft",
        json={
            "analysis_run_id": analysis["analysis_run_id"],
            "action_type": "email",
            "payload": {
                "subject": "SLA DE-NRW-0107",
                "body": "Bitte Forecast prüfen.",
                "to": "partner@nordturm.demo",
            },
            "site_id": "DE-NRW-0107",
        },
    ).json()
    assert drafted["status"] == "draft"
    confirmed = client.post(f"/api/actions/{drafted['id']}/confirm").json()
    assert confirmed["status"] == "confirmed"
    assert confirmed["result"]["channel"] in {"eml", "composio"}
    if confirmed["result"]["channel"] == "eml":
        assert confirmed["result"]["path"].endswith(".eml")
    get_settings.cache_clear()


def test_confirm_composio_failure_marks_failed(monkeypatch) -> None:
    from rolloutguard_api.core.config import get_settings
    from rolloutguard_api.integrations import composio_executor

    get_settings.cache_clear()
    composio_executor._session_cache.clear()
    monkeypatch.setenv("COMPOSIO_API_KEY", "test-key")

    def boom(_action):
        raise RuntimeError("composio_down")

    monkeypatch.setattr(composio_executor, "_composio_execute", boom)

    client = TestClient(create_app())
    projects = client.get("/api/projects").json()
    project_id = projects[0]["id"]
    analysis = client.post(f"/api/projects/{project_id}/analyze-synthetic").json()
    drafted = client.post(
        f"/api/projects/{project_id}/actions/draft",
        json={
            "analysis_run_id": analysis["analysis_run_id"],
            "action_type": "email",
            "payload": {"subject": "Test", "body": "Body", "to": "a@b.demo"},
        },
    ).json()
    confirmed = client.post(f"/api/actions/{drafted['id']}/confirm").json()
    assert confirmed["status"] == "failed"
    assert confirmed["result"]["error"] == "composio_execute_failed"
    assert confirmed["result"]["channel"] == "eml"
    get_settings.cache_clear()
    composio_executor._session_cache.clear()


def test_integrations_status_without_key(monkeypatch) -> None:
    from rolloutguard_api.core.config import get_settings
    from rolloutguard_api.integrations import composio_executor

    composio_executor._session_cache.clear()
    get_settings.cache_clear()
    monkeypatch.setenv("COMPOSIO_API_KEY", "")
    client = TestClient(create_app())
    status = client.get("/api/integrations/status").json()
    assert "mode" in status
    assert status["calendar"].startswith("RolloutGuard")
    assert status["connected"] is False
    get_settings.cache_clear()


def test_integrations_status_connected_when_session_live(monkeypatch) -> None:
    from rolloutguard_api.core.config import get_settings
    from rolloutguard_api.integrations import composio_executor

    composio_executor._session_cache.clear()
    get_settings.cache_clear()
    monkeypatch.setenv("COMPOSIO_API_KEY", "test-key")
    monkeypatch.setattr(
        composio_executor,
        "_composio_client",
        lambda: object(),
    )
    monkeypatch.setattr(
        composio_executor,
        "_active_toolkits",
        lambda: {"gmail", "googlecalendar", "notion"},
    )
    client = TestClient(create_app())
    status = client.get("/api/integrations/status").json()
    assert status["connected"] is True
    assert status["session_ready"] is True
    assert status["oauth_needed"] is False
    assert status["mode"] == "live"
    composio_executor._session_cache.clear()
    get_settings.cache_clear()


def test_integrations_status_not_connected_with_key_but_no_session(monkeypatch) -> None:
    from rolloutguard_api.core.config import get_settings
    from rolloutguard_api.integrations import composio_executor

    composio_executor._session_cache.clear()
    get_settings.cache_clear()
    monkeypatch.setenv("COMPOSIO_API_KEY", "bad-key")

    def fail_session():
        raise RuntimeError("auth")

    monkeypatch.setattr(composio_executor, "_composio_client", fail_session)
    client = TestClient(create_app())
    status = client.get("/api/integrations/status").json()
    assert status["connected"] is False
    assert status["session_ready"] is False
    composio_executor._session_cache.clear()
    get_settings.cache_clear()


def test_connect_key_uses_consumer_header() -> None:
    from rolloutguard_api.integrations.composio_executor import _auth_headers_for_key

    assert _auth_headers_for_key("ck_example") == {"x-consumer-api-key": "ck_example"}
    assert _auth_headers_for_key("ak_example") == {"x-api-key": "ak_example"}
