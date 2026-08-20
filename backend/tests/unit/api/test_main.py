from fastapi.testclient import TestClient

from app.main import create_app


def test_create_app_registers_docs() -> None:
    app = create_app()

    assert app.title == "Marmarkos ABNUB API"
    assert app.version == "0.1.0"
    assert app.docs_url == "/docs"
    assert app.redoc_url == "/redoc"


def test_openapi_schema_exposes_health_endpoint(client: TestClient) -> None:
    response = client.get("/openapi.json")

    assert response.status_code == 200
    assert "/api/v1/health" in response.json()["paths"]


def test_docs_page_is_served(client: TestClient) -> None:
    response = client.get("/docs")

    assert response.status_code == 200
    assert "Swagger UI" in response.text
