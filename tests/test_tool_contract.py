from __future__ import annotations

import asyncio
from datetime import datetime, timezone


def test_status_get_returns_minimal_structured_answer(server_module):
    resolved = server_module.status_get()

    assert resolved["workStatus"] == "off"
    assert resolved["location"] is None
    assert resolved["reason"] is None
    assert resolved["workStatusProvenance"] == {"source": "baseline"}
    assert resolved["locationProvenance"] == {"source": "none"}
    assert isinstance(resolved["effectiveDate"], str)
    assert isinstance(resolved["resolvedAt"], str)
    assert isinstance(resolved["lastUpdated"], str)


def test_tool_inventory_does_not_expose_legacy_status_set_override(server_module):
    tools = asyncio.run(server_module.mcp.list_tools())
    tool_names = {tool.name for tool in tools}

    assert "status_set_override" not in tool_names
    assert "status_set_work" in tool_names


def test_status_get_work_returns_effective_work_slice(server_module, fixed_now):
    fixed_now(datetime(2026, 5, 18, 9, 0, tzinfo=timezone.utc))
    server_module.status_set_work("working")

    resolved = server_module.status_get_work(date="2026-05-18")

    assert resolved == {
        "workStatus": "working",
        "effectiveDate": "2026-05-18",
    }


def test_status_set_location_returns_camel_case_location_name(server_module, fixed_now):
    fixed_now(datetime(2026, 5, 18, 9, 0, tzinfo=timezone.utc))

    resolved = server_module.status_set_location(
        latitude=51.501,
        longitude=-0.142,
        locationName="Buckingham Palace",
    )

    assert resolved == {
        "location": {
            "latitude": 51.501,
            "longitude": -0.142,
            "locationName": "Buckingham Palace",
            "source": "manual",
            "timestamp": "2026-05-18T09:00:00Z",
        },
        "effectiveDate": "2026-05-18",
    }


def test_status_get_location_returns_null_when_current_location_is_expired(
    server_module,
    fixed_now,
):
    fixed_now(datetime(2026, 5, 18, 9, 0, tzinfo=timezone.utc))
    server_module.status_set_location(
        latitude=51.501,
        longitude=-0.142,
        ttlSeconds=60,
    )

    fixed_now(datetime(2026, 5, 18, 9, 2, tzinfo=timezone.utc))
    resolved = server_module.status_get_location()

    assert resolved == {
        "location": None,
        "effectiveDate": "2026-05-18",
    }


def test_status_get_location_returns_null_when_current_location_is_stale(
    server_module,
    fixed_now,
):
    fixed_now(datetime(2026, 5, 18, 9, 0, tzinfo=timezone.utc))
    server_module.status_set_location(
        latitude=51.501,
        longitude=-0.142,
    )

    fixed_now(datetime(2026, 5, 18, 16, 0, tzinfo=timezone.utc))
    resolved = server_module.status_get_location()

    assert resolved == {
        "location": None,
        "effectiveDate": "2026-05-18",
    }


def test_status_set_location_rejects_non_manual_public_source(server_module):
    try:
        server_module.status_set_location(
            latitude=51.501,
            longitude=-0.142,
            source="homeassistant",
        )
    except ValueError as exc:
        assert str(exc) == "Public location writes must use manual source"
    else:
        raise AssertionError("Expected ValueError for non-manual public location source")
