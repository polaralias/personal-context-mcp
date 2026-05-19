from __future__ import annotations

from datetime import datetime, timezone


def test_schema_initialization_creates_expected_tables(server_module):
    store = server_module.PersonalContextStore(":memory:")

    rows = store._conn.execute(
        "SELECT name FROM sqlite_master WHERE type = 'table'"
    ).fetchall()
    table_names = {row["name"] for row in rows}

    assert {
        "work_status_events",
        "location_events",
        "scheduled_status",
        "bank_holidays_cache",
    }.issubset(table_names)


def test_schedule_upsert_replaces_existing_patch_for_same_date(server_module, fixed_now):
    fixed_now(datetime(2026, 5, 18, 9, 0, tzinfo=timezone.utc))
    store = server_module.PersonalContextStore(":memory:")

    store.upsert_schedule("2026-05-20", "working", None, "First", "manual")
    updated = store.upsert_schedule("2026-05-20", "off", None, "Second", "automated")

    assert updated["patch"] == {
        "source": "automated",
        "workStatus": "off",
        "reason": "Second",
    }
    assert store.list_schedules(None, None) == [updated]


def test_schedule_list_orders_by_date(server_module):
    store = server_module.PersonalContextStore(":memory:")

    store.upsert_schedule("2026-05-21", "working", None, None, "manual")
    store.upsert_schedule("2026-05-20", "off", None, None, "manual")

    schedules = store.list_schedules(None, None)

    assert [entry["date"] for entry in schedules] == ["2026-05-20", "2026-05-21"]


def test_schedule_delete_removes_only_requested_date(server_module):
    store = server_module.PersonalContextStore(":memory:")

    store.upsert_schedule("2026-05-20", "working", None, None, "manual")
    store.upsert_schedule("2026-05-21", "off", None, None, "manual")

    store.delete_schedule("2026-05-20")

    assert store.get_schedule("2026-05-20") is None
    assert store.get_schedule("2026-05-21")["patch"]["workStatus"] == "off"


def test_location_history_respects_bounds(server_module, fixed_now):
    store = server_module.PersonalContextStore(":memory:")

    fixed_now(datetime(2026, 5, 18, 9, 0, tzinfo=timezone.utc))
    store.insert_location(51.5, -0.1, "One", "manual", None)
    fixed_now(datetime(2026, 5, 18, 10, 0, tzinfo=timezone.utc))
    store.insert_location(51.6, -0.2, "Two", "manual", None)
    fixed_now(datetime(2026, 5, 18, 11, 0, tzinfo=timezone.utc))
    store.insert_location(51.7, -0.3, "Three", "manual", None)

    rows = store.location_history(
        datetime(2026, 5, 18, 9, 30, tzinfo=timezone.utc),
        datetime(2026, 5, 18, 10, 30, tzinfo=timezone.utc),
        10,
    )

    assert [row["name"] for row in rows] == ["Two"]


def test_cleanup_removes_only_events_older_than_retention_cutoff(server_module, fixed_now):
    store = server_module.PersonalContextStore(":memory:")

    fixed_now(datetime(2026, 5, 1, 12, 0, tzinfo=timezone.utc))
    store.insert_work_status("working", None, None)
    store.insert_location(51.5, -0.1, "Old", "manual", None)

    fixed_now(datetime(2026, 5, 20, 12, 0, tzinfo=timezone.utc))
    store.insert_work_status("off", None, None)
    store.insert_location(51.6, -0.2, "New", "manual", None)

    result = store.cleanup_old_events(retention_days=7)

    assert result == {
        "deletedWork": 1,
        "deletedLocation": 1,
        "daysToKeep": 7,
    }
    assert store.latest_work_event()["status"] == "off"
    assert store.latest_location_event()["name"] == "New"
