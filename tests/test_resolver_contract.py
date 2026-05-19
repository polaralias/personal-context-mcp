from __future__ import annotations

from datetime import datetime, timezone
import pytest


def test_work_status_event_created_after_target_date_does_not_affect_that_date(
    server_module,
    fixed_now,
):
    fixed_now(datetime(2026, 5, 17, 9, 0, tzinfo=timezone.utc))
    server_module.status_set_work("working")

    resolved = server_module.status_get(date="2026-05-15")

    assert resolved["effectiveDate"] == "2026-05-15"
    assert resolved["workStatus"] == "off"


def test_future_date_uses_scheduled_location_instead_of_current_live_location(
    server_module,
    fixed_now,
):
    fixed_now(datetime(2026, 5, 17, 9, 0, tzinfo=timezone.utc))
    server_module.status_set_location(
        latitude=51.501,
        longitude=-0.142,
        locationName="Buckingham Palace",
    )
    server_module.status_schedule_set(
        date="2026-05-20",
        location={
            "latitude": 51.503,
            "longitude": -0.119,
            "locationName": "Waterloo",
            "source": "manual",
        },
    )

    resolved = server_module.status_get(date="2026-05-20")

    assert resolved["effectiveDate"] == "2026-05-20"
    assert resolved["location"] == {
        "latitude": 51.503,
        "longitude": -0.119,
        "locationName": "Waterloo",
    }


def test_schedule_with_reason_only_is_rejected(server_module):
    with pytest.raises(ValueError, match="must include workStatus, location, or both"):
        server_module.status_schedule_set(
            date="2026-05-20",
            reason="Heads-up only",
        )


def test_schedule_rejects_invalid_source(server_module):
    with pytest.raises(ValueError, match="Invalid scheduled context source"):
        server_module.status_schedule_set(
            date="2026-05-20",
            workStatus="working",
            source="calendar",
        )


def test_schedule_accepts_manual_source_and_persists_it(server_module):
    server_module.status_schedule_set(
        date="2026-05-20",
        workStatus="working",
        source="manual",
    )

    schedules = server_module.status_schedule_list()

    assert schedules == [
        {
            "date": "2026-05-20",
            "patch": {
                "workStatus": "working",
                "source": "manual",
            },
            "createdAt": schedules[0]["createdAt"],
            "updatedAt": schedules[0]["updatedAt"],
        }
    ]


def test_schedule_rejects_non_manual_public_source(server_module):
    with pytest.raises(ValueError, match="Public scheduled-context writes must use manual source"):
        server_module.status_schedule_set(
            date="2026-05-20",
            workStatus="working",
            source="automated",
        )


def test_schedule_normalizes_location_and_strips_nested_location_source(server_module):
    server_module.status_schedule_set(
        date="2026-05-20",
        location={
            "latitude": "51.503",
            "longitude": -0.119,
            "location_name": "Waterloo",
            "source": "homeassistant",
        },
    )

    schedules = server_module.status_schedule_list()

    assert schedules == [
        {
            "date": "2026-05-20",
            "patch": {
                "location": {
                    "latitude": 51.503,
                    "longitude": -0.119,
                    "locationName": "Waterloo",
                },
                "source": "manual",
            },
            "createdAt": schedules[0]["createdAt"],
            "updatedAt": schedules[0]["updatedAt"],
        }
    ]


def test_schedule_rejects_location_missing_latitude(server_module):
    with pytest.raises(ValueError, match="Scheduled location must include latitude and longitude"):
        server_module.status_schedule_set(
            date="2026-05-20",
            location={
                "longitude": -0.119,
                "locationName": "Waterloo",
            },
        )


def test_schedule_rejects_location_with_non_numeric_coordinates(server_module):
    with pytest.raises(ValueError, match="Scheduled location coordinates must be numeric"):
        server_module.status_schedule_set(
            date="2026-05-20",
            location={
                "latitude": "north",
                "longitude": -0.119,
                "locationName": "Waterloo",
            },
        )


def test_current_day_work_status_event_outranks_schedule_and_surfaces_reason_and_provenance(
    server_module,
    fixed_now,
):
    fixed_now(datetime(2026, 5, 18, 9, 0, tzinfo=timezone.utc))
    server_module.status_schedule_set(
        date="2026-05-18",
        workStatus="off",
        reason="Planned leave",
        source="manual",
    )
    server_module.status_set_work("working", reason="Back online")

    resolved = server_module.status_get(date="2026-05-18")

    assert resolved["workStatus"] == "working"
    assert resolved["reason"] == "Back online"
    assert resolved["workStatusProvenance"] == {
        "source": "work-status-event",
        "eventSource": "manual",
    }
    assert resolved["locationProvenance"] == {
        "source": "none",
    }


def test_scheduled_work_status_can_override_weekend_while_weekend_flag_remains_visible(
    server_module,
):
    server_module.status_schedule_set(
        date="2026-05-17",
        workStatus="working",
        source="manual",
    )

    resolved = server_module.status_get(date="2026-05-17")

    assert resolved["weekend"] is True
    assert resolved["workStatus"] == "working"
    assert resolved["workStatusProvenance"] == {
        "source": "scheduled-context",
        "scheduledContextSource": "manual",
    }


def test_current_day_scheduled_location_applies_when_no_live_location_exists(
    server_module,
    fixed_now,
):
    fixed_now(datetime(2026, 5, 18, 9, 0, tzinfo=timezone.utc))
    server_module.status_schedule_set(
        date="2026-05-18",
        location={
            "latitude": 51.515,
            "longitude": -0.141,
            "locationName": "Marylebone",
        },
        source="manual",
    )

    resolved = server_module.status_get(date="2026-05-18")

    assert resolved["location"] == {
        "latitude": 51.515,
        "longitude": -0.141,
        "locationName": "Marylebone",
    }
    assert resolved["locationProvenance"] == {
        "source": "scheduled-context",
        "scheduledContextSource": "manual",
    }


def test_current_day_fresh_live_location_outranks_scheduled_location(
    server_module,
    fixed_now,
):
    fixed_now(datetime(2026, 5, 18, 9, 0, tzinfo=timezone.utc))
    server_module.status_schedule_set(
        date="2026-05-18",
        location={
            "latitude": 51.515,
            "longitude": -0.141,
            "locationName": "Marylebone",
        },
        source="manual",
    )
    server_module.status_set_location(
        latitude=51.501,
        longitude=-0.142,
        locationName="Buckingham Palace",
    )

    resolved = server_module.status_get(date="2026-05-18")

    assert resolved["location"] == {
        "latitude": 51.501,
        "longitude": -0.142,
        "locationName": "Buckingham Palace",
        "source": "manual",
        "timestamp": "2026-05-18T09:00:00Z",
    }
    assert resolved["locationProvenance"] == {
        "source": "location-event",
        "eventSource": "manual",
    }


def test_past_date_without_schedule_has_no_location_even_when_live_location_exists(
    server_module,
    fixed_now,
):
    fixed_now(datetime(2026, 5, 18, 9, 0, tzinfo=timezone.utc))
    server_module.status_set_location(
        latitude=51.501,
        longitude=-0.142,
        locationName="Buckingham Palace",
    )

    resolved = server_module.status_get(date="2026-05-15")

    assert resolved["location"] is None
    assert resolved["locationProvenance"] == {"source": "none"}


def test_location_write_rejects_invalid_source(server_module):
    with pytest.raises(ValueError, match="Invalid location source"):
        server_module.status_set_location(
            latitude=51.501,
            longitude=-0.142,
            source="gps",
        )


def test_resolver_accepts_internally_written_homeassistant_location(server_module):
    server_module.store.insert_location(
        latitude=51.501,
        longitude=-0.142,
        location_name="Home",
        source="homeassistant",
        ttl_seconds=None,
    )

    resolved = server_module.status_get()

    assert resolved["location"]["source"] == "homeassistant"


def test_current_location_uses_latest_valid_event_not_latest_invalid_event(
    server_module,
    fixed_now,
    monkeypatch,
):
    monkeypatch.setenv("LOCATION_STALE_HOURS", "12")
    fixed_now(datetime(2026, 5, 18, 9, 0, tzinfo=timezone.utc))
    server_module.status_set_location(
        latitude=51.501,
        longitude=-0.142,
        locationName="Valid earlier point",
    )

    fixed_now(datetime(2026, 5, 18, 17, 0, tzinfo=timezone.utc))
    server_module.status_set_location(
        latitude=51.52,
        longitude=-0.1,
        locationName="Expired later point",
        ttlSeconds=60,
    )

    fixed_now(datetime(2026, 5, 18, 18, 5, tzinfo=timezone.utc))
    resolved = server_module.status_get()

    assert resolved["location"] == {
        "latitude": 51.501,
        "longitude": -0.142,
        "locationName": "Valid earlier point",
        "source": "manual",
        "timestamp": "2026-05-18T09:00:00Z",
    }


def test_current_location_uses_latest_fresh_event_when_multiple_live_events_are_valid(
    server_module,
    fixed_now,
    monkeypatch,
):
    monkeypatch.setenv("LOCATION_STALE_HOURS", "12")
    fixed_now(datetime(2026, 5, 18, 9, 0, tzinfo=timezone.utc))
    server_module.status_set_location(
        latitude=51.501,
        longitude=-0.142,
        locationName="Morning point",
    )

    fixed_now(datetime(2026, 5, 18, 11, 0, tzinfo=timezone.utc))
    server_module.status_set_location(
        latitude=51.515,
        longitude=-0.141,
        locationName="Late morning point",
    )

    fixed_now(datetime(2026, 5, 18, 12, 0, tzinfo=timezone.utc))
    resolved = server_module.status_get()

    assert resolved["location"] == {
        "latitude": 51.515,
        "longitude": -0.141,
        "locationName": "Late morning point",
        "source": "manual",
        "timestamp": "2026-05-18T11:00:00Z",
    }
    assert resolved["locationProvenance"] == {
        "source": "location-event",
        "eventSource": "manual",
    }


def test_current_day_scheduled_location_applies_when_live_location_is_stale(
    server_module,
    fixed_now,
):
    fixed_now(datetime(2026, 5, 18, 9, 0, tzinfo=timezone.utc))
    server_module.status_set_location(
        latitude=51.501,
        longitude=-0.142,
        locationName="Morning point",
    )
    server_module.status_schedule_set(
        date="2026-05-18",
        location={
            "latitude": 51.515,
            "longitude": -0.141,
            "locationName": "Marylebone",
        },
        source="manual",
    )

    fixed_now(datetime(2026, 5, 18, 18, 0, tzinfo=timezone.utc))
    resolved = server_module.status_get(date="2026-05-18")

    assert resolved["location"] == {
        "latitude": 51.515,
        "longitude": -0.141,
        "locationName": "Marylebone",
    }


def test_current_day_scheduled_location_applies_when_live_location_is_expired(
    server_module,
    fixed_now,
):
    fixed_now(datetime(2026, 5, 18, 9, 0, tzinfo=timezone.utc))
    server_module.status_set_location(
        latitude=51.501,
        longitude=-0.142,
        locationName="Morning point",
        ttlSeconds=60,
    )
    server_module.status_schedule_set(
        date="2026-05-18",
        location={
            "latitude": 51.515,
            "longitude": -0.141,
            "locationName": "Marylebone",
        },
        source="manual",
    )

    fixed_now(datetime(2026, 5, 18, 9, 2, tzinfo=timezone.utc))
    resolved = server_module.status_get(date="2026-05-18")

    assert resolved["location"] == {
        "latitude": 51.515,
        "longitude": -0.141,
        "locationName": "Marylebone",
    }
    assert resolved["locationProvenance"] == {
        "source": "scheduled-context",
        "scheduledContextSource": "manual",
    }


def test_location_event_is_not_applicable_at_exact_expiry_time(
    server_module,
    fixed_now,
):
    fixed_now(datetime(2026, 5, 18, 9, 0, tzinfo=timezone.utc))
    server_module.status_set_location(
        latitude=51.501,
        longitude=-0.142,
        locationName="Buckingham Palace",
        ttlSeconds=60,
    )

    fixed_now(datetime(2026, 5, 18, 9, 1, tzinfo=timezone.utc))
    resolved = server_module.status_get_location()

    assert resolved == {
        "location": None,
        "effectiveDate": "2026-05-18",
    }


def test_location_event_at_exact_stale_boundary_remains_applicable(
    server_module,
    fixed_now,
    monkeypatch,
):
    monkeypatch.setenv("LOCATION_STALE_HOURS", "6")
    fixed_now(datetime(2026, 5, 18, 9, 0, tzinfo=timezone.utc))
    server_module.status_set_location(
        latitude=51.501,
        longitude=-0.142,
        locationName="Buckingham Palace",
    )

    fixed_now(datetime(2026, 5, 18, 15, 0, tzinfo=timezone.utc))
    resolved = server_module.status_get_location()

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


def test_expired_later_work_status_event_does_not_outrank_earlier_still_valid_event(
    server_module,
    fixed_now,
):
    fixed_now(datetime(2026, 5, 18, 9, 0, tzinfo=timezone.utc))
    server_module.status_set_work("working")

    fixed_now(datetime(2026, 5, 18, 10, 0, tzinfo=timezone.utc))
    server_module.status_set_work("off", ttlSeconds=60)

    fixed_now(datetime(2026, 5, 18, 10, 5, tzinfo=timezone.utc))
    resolved = server_module.status_get(date="2026-05-18")

    assert resolved["workStatus"] == "working"
    assert resolved["workStatusProvenance"] == {
        "source": "work-status-event",
        "eventSource": "manual",
    }
