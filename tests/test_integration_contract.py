from __future__ import annotations

from urllib.error import URLError

from tests.support_http import FakeHttpResponse, http_error


def test_location_write_survives_google_reverse_geocode_failure(load_server_module, monkeypatch):
    server_module = load_server_module(
        GOOGLE_API_KEY="test-google-key",
    )
    server_module.google_maps = server_module.GoogleMapsService()

    def raising_urlopen(_request, timeout):
        raise URLError("boom")

    monkeypatch.setattr(server_module, "urlopen", raising_urlopen)

    resolved = server_module.status_set_location(
        latitude=51.501,
        longitude=-0.142,
    )

    assert resolved["location"]["latitude"] == 51.501
    assert resolved["location"]["longitude"] == -0.142
    assert resolved["location"]["locationName"] is None


def test_location_write_uses_google_reverse_geocode_successfully(load_server_module, monkeypatch):
    server_module = load_server_module(
        GOOGLE_API_KEY="test-google-key",
    )
    server_module.google_maps = server_module.GoogleMapsService()

    monkeypatch.setattr(
        server_module,
        "urlopen",
        lambda _request, timeout: FakeHttpResponse(
            {
                "status": "OK",
                "results": [
                    {
                        "formatted_address": "Buckingham Palace, London SW1A 1AA, UK",
                    }
                ],
            }
        ),
    )

    resolved = server_module.status_set_location(
        latitude=51.501,
        longitude=-0.142,
    )

    assert resolved["location"]["locationName"] == "Buckingham Palace, London SW1A 1AA, UK"
    assert server_module.google_maps.status()["lastLookupStatus"] == "ok"


def test_location_write_survives_google_reverse_geocode_malformed_payload(
    load_server_module,
    monkeypatch,
):
    server_module = load_server_module(
        GOOGLE_API_KEY="test-google-key",
    )
    server_module.google_maps = server_module.GoogleMapsService()

    monkeypatch.setattr(
        server_module,
        "urlopen",
        lambda _request, timeout: FakeHttpResponse(["not", "a", "dict"]),
    )

    resolved = server_module.status_set_location(
        latitude=51.501,
        longitude=-0.142,
    )

    assert resolved["location"]["locationName"] is None
    assert server_module.google_maps.status()["lastLookupStatus"] == "error"


def test_nearby_places_surfaces_http_errors_clearly(load_server_module, monkeypatch):
    server_module = load_server_module(
        GOOGLE_API_KEY="test-google-key",
    )
    server_module.google_maps = server_module.GoogleMapsService()

    def failing_urlopen(_request, timeout):
        raise http_error(
            url="https://places.googleapis.com/v1/places:searchNearby",
            code=503,
            message="Service Unavailable",
            payload={"error": "temporarily unavailable"},
        )

    monkeypatch.setattr(server_module, "urlopen", failing_urlopen)

    try:
        server_module.places_nearby(latitude=51.501, longitude=-0.142)
    except ValueError as exc:
        assert "Google Nearby Search failed: 503 Service Unavailable" in str(exc)
    else:
        raise AssertionError("Expected ValueError for Nearby Search failure")


def test_homeassistant_missing_coordinates_fails_safely(load_server_module, monkeypatch):
    server_module = load_server_module(
        HA_URL="http://ha.local",
        HA_TOKEN="test-token",
        HA_ENTITY_ID="device_tracker.phone",
    )
    connector = server_module.HomeAssistantConnector(
        server_module.store,
        server_module.google_maps,
    )

    monkeypatch.setattr(
        server_module,
        "urlopen",
        lambda _request, timeout: FakeHttpResponse(
            {"state": "home", "attributes": {}}
        ),
    )

    result = connector.poll_location()

    assert result is None
    assert connector.status()["lastPollStatus"] == "missing-coordinates"


def test_homeassistant_invalid_coordinates_fail_safely(load_server_module, monkeypatch):
    server_module = load_server_module(
        HA_URL="http://ha.local",
        HA_TOKEN="test-token",
        HA_ENTITY_ID="device_tracker.phone",
    )
    connector = server_module.HomeAssistantConnector(
        server_module.store,
        server_module.google_maps,
    )

    monkeypatch.setattr(
        server_module,
        "urlopen",
        lambda _request, timeout: FakeHttpResponse(
            {
                "state": "home",
                "attributes": {
                    "latitude": "north",
                    "longitude": -0.142,
                },
            }
        ),
    )

    result = connector.poll_location()

    assert result is None
    assert connector.status()["lastPollStatus"] == "invalid-coordinates"


def test_homeassistant_successful_poll_stores_coordinates(load_server_module, monkeypatch):
    server_module = load_server_module(
        HA_URL="http://ha.local",
        HA_TOKEN="test-token",
        HA_ENTITY_ID="device_tracker.phone",
    )
    connector = server_module.HomeAssistantConnector(
        server_module.store,
        server_module.google_maps,
    )

    monkeypatch.setattr(
        server_module,
        "urlopen",
        lambda _request, timeout: FakeHttpResponse(
            {
                "state": "home",
                "attributes": {
                    "latitude": 51.501,
                    "longitude": -0.142,
                },
            }
        ),
    )

    record = connector.poll_location()
    resolved = server_module.status_get_location()

    assert record is not None
    assert record["source"] == "homeassistant"
    assert record["latitude"] == 51.501
    assert record["longitude"] == -0.142
    assert record["name"] == "home"
    assert resolved["location"]["source"] == "homeassistant"
    assert resolved["location"]["locationName"] == "home"
    assert connector.status()["lastPollStatus"] == "ok"


def test_status_sync_homeassistant_location_returns_successful_sync_shape(
    load_server_module,
    monkeypatch,
):
    server_module = load_server_module(
        HA_URL="http://ha.local",
        HA_TOKEN="test-token",
        HA_ENTITY_ID="device_tracker.phone",
    )
    connector = server_module.HomeAssistantConnector(
        server_module.store,
        server_module.google_maps,
    )
    server_module.home_assistant = connector
    server_module.source_manager = server_module.RuntimeSourceManager(
        server_module.store,
        server_module.google_maps,
        connector,
    )

    monkeypatch.setattr(
        server_module,
        "urlopen",
        lambda _request, timeout: FakeHttpResponse(
            {
                "state": "home",
                "attributes": {
                    "latitude": 51.501,
                    "longitude": -0.142,
                },
            }
        ),
    )

    result = server_module.status_sync_homeassistant_location()

    assert result["configured"] is True
    assert result["synced"] is True
    assert result["record"]["source"] == "homeassistant"
    assert result["location"]["source"] == "homeassistant"
    assert result["location"]["locationName"] == "home"


def test_holiday_fetch_uses_cached_data_when_network_fails(load_server_module, monkeypatch):
    server_module = load_server_module()
    holidays = server_module.HolidayService(server_module.store)
    server_module.store.upsert_holiday_cache(
        "england-and-wales",
        2026,
        [{"date": "2026-12-25", "title": "Christmas Day"}],
    )

    monkeypatch.setattr(
        server_module,
        "urlopen",
        lambda _request, timeout: (_ for _ in ()).throw(URLError("offline")),
    )

    payload = holidays.fetch_holidays("england-and-wales", year=2026)

    assert payload == [{"date": "2026-12-25", "title": "Christmas Day"}]


def test_holiday_fetch_writes_cache_on_success(load_server_module, monkeypatch):
    server_module = load_server_module()
    holidays = server_module.HolidayService(server_module.store)

    monkeypatch.setattr(
        server_module,
        "urlopen",
        lambda _request, timeout: FakeHttpResponse(
            {
                "england-and-wales": {
                    "events": [{"date": "2026-12-25", "title": "Christmas Day"}]
                }
            }
        ),
    )

    payload = holidays.fetch_holidays("england-and-wales", year=2026)
    cached = server_module.store.holiday_cache("england-and-wales", 2026)

    assert payload == [{"date": "2026-12-25", "title": "Christmas Day"}]
    assert cached is not None


def test_nearby_places_normalizes_successful_response(load_server_module, monkeypatch):
    server_module = load_server_module(
        GOOGLE_API_KEY="test-google-key",
    )
    server_module.google_maps = server_module.GoogleMapsService()

    monkeypatch.setattr(
        server_module,
        "urlopen",
        lambda _request, timeout: FakeHttpResponse(
            {
                "places": [
                    {
                        "id": "abc",
                        "displayName": {"text": "Cafe Example"},
                        "primaryType": "cafe",
                        "formattedAddress": "1 Example St",
                        "googleMapsUri": "https://maps.example/cafe",
                    }
                ]
            }
        ),
    )

    result = server_module.places_nearby(latitude=51.501, longitude=-0.142)

    assert result["places"] == [
        {
            "id": "abc",
            "displayName": "Cafe Example",
            "primaryType": "cafe",
            "formattedAddress": "1 Example St",
            "googleMapsUri": "https://maps.example/cafe",
        }
    ]


def test_holidays_list_surfaces_invalid_region_clearly(load_server_module, monkeypatch):
    server_module = load_server_module()
    holidays = server_module.HolidayService(server_module.store)

    monkeypatch.setattr(
        server_module,
        "urlopen",
        lambda _request, timeout: FakeHttpResponse({"england-and-wales": {"events": []}}),
    )

    try:
        holidays.fetch_holidays("scotland", year=2026)
    except ValueError as exc:
        assert str(exc) == "Region scotland not found in holiday data"
    else:
        raise AssertionError("Expected ValueError for invalid region")
