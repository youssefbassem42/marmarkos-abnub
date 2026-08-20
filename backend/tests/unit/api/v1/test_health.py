from fastapi.testclient import TestClient


def test_health_returns_ok(client: TestClient) -> None:
    response = client.get("/api/v1/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_health_accepts_get_only(client: TestClient) -> None:
    response = client.post("/api/v1/health")

    assert response.status_code == 405
