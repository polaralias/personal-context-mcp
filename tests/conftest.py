from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
import importlib
import sys
from typing import Any

import pytest


@dataclass
class FakeHolidayService:
    dates: set[str] = field(default_factory=set)
    events_by_region: dict[str, list[dict[str, Any]]] = field(default_factory=dict)

    def is_bank_holiday(self, target: datetime, region: str = "england-and-wales") -> bool:
        return target.strftime("%Y-%m-%d") in self.dates

    def fetch_holidays(self, region: str = "england-and-wales") -> list[dict[str, Any]]:
        return list(self.events_by_region.get(region, []))


class FakeGoogleMapsService:
    configured = False

    def enrich_name(
        self,
        latitude: float,
        longitude: float,
        location_name: str | None,
    ) -> str | None:
        return location_name

    def nearby_places(self, **_: Any) -> dict[str, Any]:
        return {"places": []}

    def status(self) -> dict[str, Any]:
        return {"configured": self.configured}


class FakeHomeAssistantConnector:
    configured = False

    def status(self) -> dict[str, Any]:
        return {"configured": self.configured}


class FakeRuntimeSourceManager:
    def start(self) -> None:
        return None

    def stop(self) -> None:
        return None

    def poll_homeassistant_now(self) -> dict[str, Any] | None:
        return None

    def enrich_latest_location_now(self) -> dict[str, Any] | None:
        return None

    def status(self) -> dict[str, Any]:
        return {"running": False}


@pytest.fixture
def load_server_module(monkeypatch: pytest.MonkeyPatch):
    def _load(*, disable_auth: bool = True, **env: str):
        monkeypatch.setenv("DATABASE_URL", ":memory:")
        if disable_auth:
            monkeypatch.setenv("API_KEY_MODE", "disabled")
        else:
            monkeypatch.delenv("API_KEY_MODE", raising=False)
            monkeypatch.delenv("PERSONAL_API_KEY_MODE", raising=False)
        for key, value in env.items():
            monkeypatch.setenv(key, value)

        sys.modules.pop("server", None)
        server = importlib.import_module("server")
        server = importlib.reload(server)

        store = server.PersonalContextStore(":memory:")
        holidays = FakeHolidayService()

        server.store = store
        server.holidays = holidays
        server.resolver = server.StatusResolver(store, holidays)
        server.google_maps = FakeGoogleMapsService()
        server.home_assistant = FakeHomeAssistantConnector()
        server.source_manager = FakeRuntimeSourceManager()
        server.database_path = ":memory:"
        return server

    return _load


@pytest.fixture
def server_module(load_server_module):
    return load_server_module()


@pytest.fixture
def fixed_now(server_module, monkeypatch: pytest.MonkeyPatch):
    def _set(when: datetime) -> datetime:
        aware = when.astimezone(timezone.utc)
        monkeypatch.setattr(server_module, "_now_utc", lambda: aware)
        return aware

    return _set
