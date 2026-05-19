from __future__ import annotations

from starlette.testclient import TestClient


def test_health_route_is_public(load_server_module):
    server_module = load_server_module(
        disable_auth=False,
        PERSONAL_CONTEXT_MCP_API_KEY="test-key",
    )
    app = server_module.mcp.http_app(path="/mcp", transport="streamable-http")

    with TestClient(app) as client:
        response = client.get("/health")

    assert response.status_code == 200
    assert response.json()["status"] == "ok"


def test_health_payload_reports_precise_auth_mode_and_omits_inactive_security_knobs(
    load_server_module,
):
    server_module = load_server_module(
        disable_auth=False,
        PERSONAL_CONTEXT_MCP_API_KEY="test-key",
    )
    app = server_module.mcp.http_app(path="/mcp", transport="streamable-http")

    with TestClient(app) as client:
        response = client.get("/health")

    payload = response.json()

    assert payload["mcpAuthMode"] == "bearer-token"
    assert "codeTtlSeconds" not in payload
    assert "tokenTtlSeconds" not in payload
    assert "apiKeyIssueRateLimit" not in payload
    assert "apiKeyIssueWindowSeconds" not in payload
    assert "mcpRateLimitPerKey" not in payload
    assert "mcpRateLimitWindowSeconds" not in payload


def test_mcp_route_requires_bearer_token_when_auth_is_enabled(load_server_module):
    server_module = load_server_module(
        disable_auth=False,
        PERSONAL_CONTEXT_MCP_API_KEY="test-key",
    )
    app = server_module.mcp.http_app(path="/mcp", transport="streamable-http")

    with TestClient(app) as client:
        response = client.post("/mcp")

    assert response.status_code == 401


def test_mcp_route_accepts_authenticated_request_when_auth_is_enabled(load_server_module):
    server_module = load_server_module(
        disable_auth=False,
        PERSONAL_CONTEXT_MCP_API_KEY="test-key",
    )
    app = server_module.mcp.http_app(path="/mcp", transport="streamable-http")

    with TestClient(app) as client:
        response = client.post(
            "/mcp",
            headers={"Authorization": "Bearer test-key"},
        )

    assert response.status_code != 401


def test_mcp_route_does_not_require_auth_when_disabled(load_server_module):
    server_module = load_server_module(disable_auth=True)
    app = server_module.mcp.http_app(path="/mcp", transport="streamable-http")

    with TestClient(app) as client:
        response = client.post("/mcp")

    assert response.status_code != 401


def test_health_payload_reports_disabled_auth_mode_explicitly(load_server_module):
    server_module = load_server_module(disable_auth=True)
    app = server_module.mcp.http_app(path="/mcp", transport="streamable-http")

    with TestClient(app) as client:
        response = client.get("/health")

    assert response.json()["mcpAuthMode"] == "disabled"


def test_mcp_route_requires_auth_when_mode_is_not_disabled_even_without_keys(
    load_server_module,
):
    server_module = load_server_module(disable_auth=False)
    app = server_module.mcp.http_app(path="/mcp", transport="streamable-http")

    with TestClient(app) as client:
        response = client.post(
            "/mcp",
            headers={"Content-Type": "application/json"},
            json={},
        )
        health = client.get("/health")

    assert response.status_code == 401
    assert health.json()["mcpAuthMode"] == "unconfigured"


def test_api_key_env_aliases_are_loaded_and_deduplicated(load_server_module):
    server_module = load_server_module(
        disable_auth=False,
        PERSONAL_CONTEXT_MCP_API_KEY="primary",
        MCP_API_KEY="secondary",
        MCP_API_KEYS="secondary, tertiary, primary",
    )

    assert server_module.api_keys == ["primary", "secondary", "tertiary"]
