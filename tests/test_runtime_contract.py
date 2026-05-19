from __future__ import annotations


def test_location_history_rejects_non_positive_limit(server_module):
    try:
        server_module.status_get_location_history(limit=0)
    except ValueError as exc:
        assert str(exc) == "limit must be at least 1"
    else:
        raise AssertionError("Expected ValueError for non-positive limit")


def test_resolve_database_path_defaults_to_repo_local_data_directory(
    server_module,
    monkeypatch,
    tmp_path,
):
    monkeypatch.delenv("DATABASE_URL", raising=False)
    monkeypatch.delenv("PERSONAL_DATABASE_URL", raising=False)
    monkeypatch.chdir(tmp_path)

    resolved = server_module._resolve_database_path()

    assert resolved == str((tmp_path / "data" / "mcp.db").resolve())


def test_holiday_lookup_uses_target_year_cache(server_module):
    store = server_module.PersonalContextStore(":memory:")
    holidays = server_module.HolidayService(store)

    store.upsert_holiday_cache(
        "england-and-wales",
        2025,
        [{"date": "2025-12-25", "title": "Christmas Day"}],
    )
    store.upsert_holiday_cache(
        "england-and-wales",
        2026,
        [],
    )

    assert holidays.is_bank_holiday(server_module._parse_date("2025-12-25")) is True
