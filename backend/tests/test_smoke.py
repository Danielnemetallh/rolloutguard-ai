from fastapi.testclient import TestClient

from rolloutguard_api.db.session import engine
from rolloutguard_api.main import create_app


def test_health_live() -> None:
    client = TestClient(create_app())
    response = client.get("/health/live")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"


def test_meta_disclaimer() -> None:
    client = TestClient(create_app())
    response = client.get("/api/meta")
    assert response.status_code == 200
    body = response.json()
    assert body["demo_mode"] is True
    assert body["synthetic_data"] is True
    assert "Not affiliated" in body["disclaimer"]


def test_engine_configured() -> None:
    assert engine is not None
    url = str(engine.url)
    assert "sqlite" in url or "postgresql" in url
