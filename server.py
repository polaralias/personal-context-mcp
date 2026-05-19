from __future__ import annotations

import json
import logging
import os
import re
import secrets
import sqlite3
import threading
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Annotated, Any
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

from fastmcp import FastMCP
from fastmcp.server.auth import AccessToken, TokenVerifier
from fastmcp.server.lifespan import lifespan
from pydantic import Field
from starlette.responses import JSONResponse

HOLIDAY_URL = "https://www.gov.uk/bank-holidays.json"
DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")
RUNTIME_PLACEHOLDER_RE = re.compile(r"^\$\{[A-Za-z_][A-Za-z0-9_]*\}$")
logger = logging.getLogger("personal-context-mcp")
DEFAULT_NEARBY_PLACE_TYPES = (
    "tourist_attraction",
    "museum",
    "art_gallery",
    "park",
    "cafe",
    "bar",
    "book_store",
    "library",
)
DEFAULT_NEARBY_PLACE_FIELD_MASK = ",".join(
    (
        "places.id",
        "places.displayName",
        "places.primaryType",
        "places.formattedAddress",
        "places.googleMapsUri",
    )
)
VALID_NEARBY_RANK_PREFERENCES = {"POPULARITY", "DISTANCE"}
VALID_LOCATION_SOURCES = {"manual", "homeassistant"}
VALID_SCHEDULED_CONTEXT_SOURCES = {"manual", "automated"}


def _runtime_env(*names: str, default: str = "") -> str:
    for name in names:
        value = os.getenv(name)
        if value is None:
            continue
        cleaned = value.strip()
        if not cleaned or RUNTIME_PLACEHOLDER_RE.fullmatch(cleaned):
            continue
        return cleaned
    return default


def _now_utc() -> datetime:
    return datetime.now(timezone.utc)


def _to_iso(dt: datetime) -> str:
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")


def _parse_date(date_str: str) -> datetime:
    if not DATE_RE.match(date_str):
        raise ValueError("Invalid date format. Use YYYY-MM-DD")
    return datetime.strptime(date_str, "%Y-%m-%d").replace(tzinfo=timezone.utc)


def _parse_optional_datetime(value: str | None, label: str) -> datetime | None:
    if not value:
        return None
    parsed = value.replace("Z", "+00:00")
    try:
        dt = datetime.fromisoformat(parsed)
    except ValueError as exc:
        raise ValueError(f"Invalid {label} date") from exc
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def _resolve_database_path() -> str:
    default = "data/mcp.db"
    raw = _runtime_env("DATABASE_URL", "PERSONAL_DATABASE_URL", default=default)
    if raw in {":memory:", "sqlite::memory:", "file::memory:"}:
        return ":memory:"

    normalized = raw
    if normalized.startswith("sqlite:"):
        normalized = normalized[len("sqlite:") :]
    elif normalized.startswith("file:"):
        normalized = normalized[len("file:") :]

    if normalized.startswith("//"):
        normalized = normalized[2:]

    if normalized == ":memory:":
        return ":memory:"

    if normalized.startswith("/") and re.match(r"^[A-Za-z]:", normalized[1:3] or ""):
        normalized = normalized[1:]

    path = Path(normalized)
    if not path.is_absolute():
        path = Path.cwd() / path

    path.parent.mkdir(parents=True, exist_ok=True)
    return str(path.resolve())


def _runtime_int(*names: str, default: int) -> int:
    value = _runtime_env(*names, default=str(default))
    try:
        return int(value)
    except ValueError:
        return default


def _runtime_float(*names: str, default: float) -> float:
    value = _runtime_env(*names, default=str(default))
    try:
        return float(value)
    except ValueError:
        return default


def _http_error_message(exc: HTTPError) -> str:
    try:
        body = exc.read().decode("utf-8", errors="replace").strip()
    except Exception:
        body = ""

    if body:
        return f"{exc.code} {exc.reason}: {body}"
    return f"{exc.code} {exc.reason}"


def _parse_cron_field(segment: str, minimum: int, maximum: int) -> set[int]:
    values: set[int] = set()

    for part in segment.split(","):
        token = part.strip()
        if not token:
            raise ValueError(f"Invalid cron field: {segment}")

        step = 1
        base = token
        if "/" in token:
            base, step_raw = token.split("/", 1)
            try:
                step = int(step_raw)
            except ValueError as exc:
                raise ValueError(f"Invalid cron step: {token}") from exc
            if step <= 0:
                raise ValueError(f"Invalid cron step: {token}")

        if base == "*":
            start = minimum
            end = maximum
        elif "-" in base:
            start_raw, end_raw = base.split("-", 1)
            start = int(start_raw)
            end = int(end_raw)
        else:
            start = int(base)
            end = start

        if start < minimum or end > maximum or start > end:
            raise ValueError(f"Cron field {segment} is out of range")

        values.update(range(start, end + 1, step))

    return values


@dataclass(frozen=True)
class SimpleCronSchedule:
    minutes: set[int]
    hours: set[int]
    days: set[int]
    months: set[int]
    weekdays: set[int]

    @classmethod
    def parse(cls, expression: str) -> "SimpleCronSchedule":
        parts = expression.split()
        if len(parts) != 5:
            raise ValueError("Cron must have 5 fields")

        minute_expr, hour_expr, day_expr, month_expr, weekday_expr = parts
        weekdays = _parse_cron_field(weekday_expr, 0, 7)
        if 7 in weekdays:
            weekdays.add(0)
            weekdays.discard(7)

        return cls(
            minutes=_parse_cron_field(minute_expr, 0, 59),
            hours=_parse_cron_field(hour_expr, 0, 23),
            days=_parse_cron_field(day_expr, 1, 31),
            months=_parse_cron_field(month_expr, 1, 12),
            weekdays=weekdays,
        )

    def matches(self, when: datetime) -> bool:
        cron_weekday = (when.weekday() + 1) % 7
        return (
            when.minute in self.minutes
            and when.hour in self.hours
            and when.day in self.days
            and when.month in self.months
            and cron_weekday in self.weekdays
        )


class StaticApiKeyVerifier(TokenVerifier):
    def __init__(self, api_keys: list[str], base_url: str | None = None) -> None:
        super().__init__(base_url=base_url or None)
        self._api_keys = [k for k in api_keys if k]

    async def verify_token(self, token: str) -> AccessToken | None:
        for key in self._api_keys:
            if secrets.compare_digest(token, key):
                return AccessToken(token=token, client_id="personal-context-mcp", scopes=[])
        return None


@dataclass
class LocationRecord:
    latitude: float
    longitude: float
    locationName: str | None
    source: str | None = None
    timestamp: str | None = None


def _effective_location_payload(location: dict[str, Any] | None) -> dict[str, Any] | None:
    if not location:
        return None

    payload = {
        "latitude": float(location["latitude"]),
        "longitude": float(location["longitude"]),
        "locationName": location.get("locationName", location.get("location_name")),
    }
    if location.get("source") is not None:
        payload["source"] = location["source"]
    if location.get("timestamp") is not None:
        payload["timestamp"] = location["timestamp"]
    return payload


def _normalize_scheduled_location(location: dict[str, Any]) -> dict[str, Any]:
    if "latitude" not in location or "longitude" not in location:
        raise ValueError("Scheduled location must include latitude and longitude")

    try:
        latitude = float(location["latitude"])
        longitude = float(location["longitude"])
    except (TypeError, ValueError):
        raise ValueError("Scheduled location coordinates must be numeric") from None

    location_name = location.get("locationName", location.get("location_name"))
    if location_name is not None:
        location_name = str(location_name).strip() or None

    normalized = {
        "latitude": latitude,
        "longitude": longitude,
        "locationName": location_name,
    }
    return normalized


class GoogleMapsService:
    def __init__(self) -> None:
        self._api_key = _runtime_env("GOOGLE_API_KEY", "PERSONAL_GOOGLE_API_KEY")
        timeout_ms = _runtime_int(
            "GOOGLE_HTTP_TIMEOUT_MS",
            "PERSONAL_GOOGLE_HTTP_TIMEOUT_MS",
            default=5000,
        )
        self._timeout_seconds = max(timeout_ms, 1) / 1000
        self._lock = threading.Lock()
        self._last_lookup_at: str | None = None
        self._last_lookup_status: str | None = None
        self._last_error: str | None = None
        self._last_nearby_search_at: str | None = None
        self._last_nearby_search_status: str | None = None
        self._last_nearby_search_error: str | None = None

    @property
    def configured(self) -> bool:
        return bool(self._api_key)

    def status(self) -> dict[str, Any]:
        with self._lock:
            return {
                "configured": self.configured,
                "lastLookupAt": self._last_lookup_at,
                "lastLookupStatus": self._last_lookup_status,
                "lastLookupError": self._last_error,
                "lastNearbySearchAt": self._last_nearby_search_at,
                "lastNearbySearchStatus": self._last_nearby_search_status,
                "lastNearbySearchError": self._last_nearby_search_error,
            }

    def _record_lookup(self, status: str, error: str | None = None) -> None:
        with self._lock:
            self._last_lookup_at = _to_iso(_now_utc())
            self._last_lookup_status = status
            self._last_error = error

    def _record_nearby_search(self, status: str, error: str | None = None) -> None:
        with self._lock:
            self._last_nearby_search_at = _to_iso(_now_utc())
            self._last_nearby_search_status = status
            self._last_nearby_search_error = error

    def reverse_geocode(self, latitude: float, longitude: float) -> str | None:
        if not self._api_key:
            return None

        params = urlencode(
            {
                "latlng": f"{latitude:.6f},{longitude:.6f}",
                "key": self._api_key,
            }
        )
        request = Request(
            f"https://maps.googleapis.com/maps/api/geocode/json?{params}",
            headers={"Accept": "application/json"},
            method="GET",
        )

        try:
            with urlopen(request, timeout=self._timeout_seconds) as response:
                payload = json.loads(response.read().decode("utf-8"))
        except (HTTPError, URLError, TimeoutError, json.JSONDecodeError) as exc:
            message = str(exc)
            self._record_lookup("error", message)
            logger.warning("Google reverse geocode failed: %s", message)
            return None

        if not isinstance(payload, dict):
            message = "Malformed Google geocode response"
            self._record_lookup("error", message)
            logger.warning("Google reverse geocode failed: %s", message)
            return None

        status = str(payload.get("status") or "")
        if status == "OK":
            results = payload.get("results") or []
            if results:
                formatted = str(results[0].get("formatted_address") or "").strip()
                if formatted:
                    self._record_lookup("ok")
                    return formatted
            self._record_lookup("empty")
            return None

        if status == "ZERO_RESULTS":
            self._record_lookup("zero-results")
            return None

        error_message = str(payload.get("error_message") or status or "Unknown Google geocode error")
        self._record_lookup("error", error_message)
        logger.warning("Google reverse geocode returned %s", error_message)
        return None

    def enrich_name(self, latitude: float, longitude: float, location_name: str | None) -> str | None:
        cleaned = (location_name or "").strip()
        if cleaned:
            return cleaned
        return self.reverse_geocode(latitude, longitude)

    def nearby_places(
        self,
        latitude: float,
        longitude: float,
        radius_meters: int,
        max_results: int,
        included_types: list[str],
        rank_preference: str,
    ) -> dict[str, Any]:
        if not self._api_key:
            raise ValueError("Google API key not configured")

        if radius_meters < 1 or radius_meters > 50000:
            raise ValueError("radiusMeters must be between 1 and 50000")

        if max_results < 1 or max_results > 20:
            raise ValueError("maxResults must be between 1 and 20")

        normalized_types = [entry.strip() for entry in included_types if entry.strip()]
        if not normalized_types:
            raise ValueError("includedTypes must contain at least one place type")

        normalized_rank = rank_preference.strip().upper()
        if normalized_rank not in VALID_NEARBY_RANK_PREFERENCES:
            raise ValueError("rankPreference must be POPULARITY or DISTANCE")

        payload = {
            "includedTypes": normalized_types,
            "maxResultCount": max_results,
            "rankPreference": normalized_rank,
            "locationRestriction": {
                "circle": {
                    "center": {
                        "latitude": latitude,
                        "longitude": longitude,
                    },
                    "radius": float(radius_meters),
                }
            },
        }

        request = Request(
            "https://places.googleapis.com/v1/places:searchNearby",
            data=json.dumps(payload).encode("utf-8"),
            headers={
                "Accept": "application/json",
                "Content-Type": "application/json",
                "X-Goog-Api-Key": self._api_key,
                "X-Goog-FieldMask": DEFAULT_NEARBY_PLACE_FIELD_MASK,
            },
            method="POST",
        )

        try:
            with urlopen(request, timeout=self._timeout_seconds) as response:
                response_payload = json.loads(response.read().decode("utf-8"))
        except HTTPError as exc:
            message = _http_error_message(exc)
            self._record_nearby_search("error", message)
            logger.warning("Google Nearby Search failed: %s", message)
            raise ValueError(f"Google Nearby Search failed: {message}") from exc
        except (URLError, TimeoutError, json.JSONDecodeError) as exc:
            message = str(exc)
            self._record_nearby_search("error", message)
            logger.warning("Google Nearby Search failed: %s", message)
            raise ValueError(f"Google Nearby Search failed: {message}") from exc

        places = []
        for place in response_payload.get("places") or []:
            display_name = place.get("displayName") or {}
            places.append(
                {
                    "id": place.get("id"),
                    "displayName": display_name.get("text") if isinstance(display_name, dict) else None,
                    "primaryType": place.get("primaryType"),
                    "formattedAddress": place.get("formattedAddress"),
                    "googleMapsUri": place.get("googleMapsUri"),
                }
            )

        self._record_nearby_search("ok")
        return {
            "places": places,
            "search": {
                "latitude": latitude,
                "longitude": longitude,
                "radiusMeters": radius_meters,
                "maxResults": max_results,
                "includedTypes": normalized_types,
                "rankPreference": normalized_rank,
            },
        }


class HomeAssistantConnector:
    def __init__(self, store: "PersonalContextStore", google_maps: GoogleMapsService) -> None:
        self._store = store
        self._google_maps = google_maps
        self._base_url = _runtime_env("HA_URL").rstrip("/")
        self._token = _runtime_env("HA_TOKEN")
        self._entity_id = _runtime_env("HA_ENTITY_ID")
        timeout_ms = _runtime_int(
            "HA_TIMEOUT_MS",
            "PERSONAL_HA_TIMEOUT_MS",
            default=5000,
        )
        self._timeout_seconds = max(timeout_ms, 1) / 1000
        self._ttl_seconds = max(
            _runtime_int(
                "HA_LOCATION_TTL_SECONDS",
                "PERSONAL_HA_LOCATION_TTL_SECONDS",
                default=3600,
            ),
            1,
        )
        self._lock = threading.Lock()
        self._last_poll_at: str | None = None
        self._last_poll_status: str | None = None
        self._last_error: str | None = None

    @property
    def configured(self) -> bool:
        return bool(self._base_url and self._token and self._entity_id)

    def status(self) -> dict[str, Any]:
        with self._lock:
            return {
                "configured": self.configured,
                "lastPollAt": self._last_poll_at,
                "lastPollStatus": self._last_poll_status,
                "lastPollError": self._last_error,
                "locationTtlSeconds": self._ttl_seconds,
            }

    def _record_poll(self, status: str, error: str | None = None) -> None:
        with self._lock:
            self._last_poll_at = _to_iso(_now_utc())
            self._last_poll_status = status
            self._last_error = error

    def poll_location(self) -> dict[str, Any] | None:
        if not self.configured:
            self._record_poll("disabled")
            return None

        request = Request(
            f"{self._base_url}/api/states/{self._entity_id}",
            headers={
                "Authorization": f"Bearer {self._token}",
                "Content-Type": "application/json",
                "Accept": "application/json",
                "User-Agent": (
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                    "AppleWebKit/537.36 (KHTML, like Gecko) "
                    "Chrome/135.0.0.0 Safari/537.36"
                ),
            },
            method="GET",
        )

        try:
            with urlopen(request, timeout=self._timeout_seconds) as response:
                payload = json.loads(response.read().decode("utf-8"))
        except (HTTPError, URLError, TimeoutError, json.JSONDecodeError) as exc:
            message = str(exc)
            self._record_poll("error", message)
            logger.warning("Home Assistant poll failed: %s", message)
            return None

        attributes = payload.get("attributes") if isinstance(payload, dict) else None
        if not isinstance(attributes, dict):
            self._record_poll("missing-attributes")
            return None

        latitude = attributes.get("latitude")
        longitude = attributes.get("longitude")
        if latitude is None or longitude is None:
            self._record_poll("missing-coordinates")
            return None

        try:
            lat = float(latitude)
            lon = float(longitude)
        except (TypeError, ValueError):
            self._record_poll("invalid-coordinates")
            return None

        state = str(payload.get("state") or "").strip()
        location_name = state if state and state.lower() != "not_home" else None
        location_name = self._google_maps.enrich_name(lat, lon, location_name)
        record = self._store.insert_location(
            lat,
            lon,
            location_name,
            source="homeassistant",
            ttl_seconds=self._ttl_seconds,
        )
        self._record_poll("ok")
        return record


class RuntimeSourceManager:
    def __init__(
        self,
        store: "PersonalContextStore",
        google_maps: GoogleMapsService,
        home_assistant: HomeAssistantConnector,
    ) -> None:
        self._store = store
        self._google_maps = google_maps
        self._home_assistant = home_assistant
        self._stop_event = threading.Event()
        self._threads: list[threading.Thread] = []
        self._lock = threading.Lock()
        self._last_google_backfill_at: str | None = None
        self._last_google_backfill_status: str | None = None
        self._last_cleanup_at: str | None = None
        self._last_cleanup_result: dict[str, Any] | None = None
        self._ha_poll_interval_seconds = max(
            _runtime_int(
                "HA_POLL_INTERVAL_SECONDS",
                "PERSONAL_HA_POLL_INTERVAL_SECONDS",
                default=900,
            ),
            1,
        )
        self._cleanup_interval_seconds = max(
            _runtime_int(
                "DATA_CLEANUP_INTERVAL_SECONDS",
                "PERSONAL_DATA_CLEANUP_INTERVAL_SECONDS",
                default=24 * 60 * 60,
            ),
            60,
        )
        self._retention_days = max(
            _runtime_int(
                "DATA_RETENTION_DAYS",
                "PERSONAL_DATA_RETENTION_DAYS",
                default=90,
            ),
            1,
        )
        self._google_cron_expression = _runtime_env("GOOGLE_POLL_CRON", "PERSONAL_GOOGLE_POLL_CRON")
        self._google_schedule: SimpleCronSchedule | None = None
        self._google_schedule_error: str | None = None

        if self._google_cron_expression:
            try:
                self._google_schedule = SimpleCronSchedule.parse(self._google_cron_expression)
            except ValueError as exc:
                self._google_schedule_error = str(exc)
                logger.warning("Ignoring invalid GOOGLE_POLL_CRON value %r: %s", self._google_cron_expression, exc)

    def start(self) -> None:
        if self._threads:
            return

        self._stop_event.clear()

        if self._home_assistant.configured:
            self._start_thread("homeassistant-poller", self._home_assistant_loop)

        if self._google_maps.configured and self._google_schedule is not None:
            self._start_thread("google-backfill", self._google_backfill_loop)

        self._start_thread("data-cleanup", self._cleanup_loop)

    def stop(self) -> None:
        self._stop_event.set()
        for thread in self._threads:
            thread.join(timeout=5)
        self._threads.clear()

    def status(self) -> dict[str, Any]:
        with self._lock:
            return {
                "homeAssistantPollingEnabled": self._home_assistant.configured,
                "homeAssistantPollIntervalSeconds": self._ha_poll_interval_seconds if self._home_assistant.configured else None,
                "googleBackfillEnabled": self._google_maps.configured and self._google_schedule is not None,
                "googleBackfillCron": self._google_cron_expression or None,
                "googleBackfillCronValid": self._google_schedule_error is None if self._google_cron_expression else None,
                "googleBackfillCronError": self._google_schedule_error,
                "lastGoogleBackfillAt": self._last_google_backfill_at,
                "lastGoogleBackfillStatus": self._last_google_backfill_status,
                "dataRetentionDays": self._retention_days,
                "dataCleanupIntervalSeconds": self._cleanup_interval_seconds,
                "lastDataCleanupAt": self._last_cleanup_at,
                "lastDataCleanupResult": self._last_cleanup_result,
            }

    def poll_homeassistant_now(self) -> dict[str, Any] | None:
        return self._home_assistant.poll_location()

    def enrich_latest_location_now(self) -> dict[str, Any] | None:
        row = self._store.latest_location_without_name()
        result = None

        if row and self._google_maps.configured:
            location_name = self._google_maps.reverse_geocode(float(row["lat"]), float(row["lon"]))
            if location_name:
                result = self._store.update_location_name(int(row["id"]), location_name)

        with self._lock:
            self._last_google_backfill_at = _to_iso(_now_utc())
            self._last_google_backfill_status = "updated" if result else "noop"

        return result

    def cleanup_old_events(self) -> dict[str, Any]:
        result = self._store.cleanup_old_events(self._retention_days)
        with self._lock:
            self._last_cleanup_at = _to_iso(_now_utc())
            self._last_cleanup_result = result
        return result

    def _start_thread(self, name: str, target) -> None:
        thread = threading.Thread(target=target, name=name, daemon=True)
        thread.start()
        self._threads.append(thread)

    def _home_assistant_loop(self) -> None:
        while not self._stop_event.is_set():
            try:
                self._home_assistant.poll_location()
            except Exception:
                logger.exception("Unexpected Home Assistant polling failure")

            if self._stop_event.wait(self._ha_poll_interval_seconds):
                break

    def _google_backfill_loop(self) -> None:
        last_run_slot: str | None = None

        while not self._stop_event.is_set():
            now = _now_utc().replace(second=0, microsecond=0)
            slot = now.strftime("%Y-%m-%dT%H:%M")

            if self._google_schedule and self._google_schedule.matches(now) and slot != last_run_slot:
                last_run_slot = slot
                try:
                    self.enrich_latest_location_now()
                except Exception:
                    logger.exception("Unexpected Google backfill failure")

            if self._stop_event.wait(15):
                break

    def _cleanup_loop(self) -> None:
        while not self._stop_event.is_set():
            try:
                self.cleanup_old_events()
            except Exception:
                logger.exception("Unexpected cleanup failure")

            if self._stop_event.wait(self._cleanup_interval_seconds):
                break


class PersonalContextStore:
    def __init__(self, database_path: str) -> None:
        self._conn = sqlite3.connect(database_path, check_same_thread=False)
        self._conn.row_factory = sqlite3.Row
        self._lock = threading.Lock()
        self._conn.execute("PRAGMA journal_mode=WAL")
        self._conn.execute("PRAGMA foreign_keys=ON")
        self._init_schema()

    def _init_schema(self) -> None:
        statements = [
            """
            CREATE TABLE IF NOT EXISTS work_status_events (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                created_at INTEGER NOT NULL,
                source TEXT NOT NULL,
                status TEXT NOT NULL,
                reason TEXT,
                expires_at INTEGER
            )
            """,
            "CREATE INDEX IF NOT EXISTS work_status_events_created_at_idx ON work_status_events (created_at)",
            """
            CREATE TABLE IF NOT EXISTS location_events (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                created_at INTEGER NOT NULL,
                source TEXT NOT NULL,
                lat REAL NOT NULL,
                lon REAL NOT NULL,
                name TEXT,
                expires_at INTEGER
            )
            """,
            "CREATE INDEX IF NOT EXISTS location_events_created_at_idx ON location_events (created_at)",
            """
            CREATE TABLE IF NOT EXISTS scheduled_status (
                date TEXT PRIMARY KEY,
                patch TEXT NOT NULL,
                created_at INTEGER NOT NULL,
                updated_at INTEGER NOT NULL
            )
            """,
            """
            CREATE TABLE IF NOT EXISTS bank_holidays_cache (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                region TEXT NOT NULL,
                year INTEGER NOT NULL,
                payload TEXT NOT NULL,
                fetched_at INTEGER NOT NULL,
                UNIQUE(region, year)
            )
            """,
        ]
        with self._lock:
            for statement in statements:
                self._conn.execute(statement)
            self._conn.commit()

    def insert_work_status(self, status: str, reason: str | None, ttl_seconds: int | None) -> dict[str, Any]:
        now = _now_utc()
        expires = now + timedelta(seconds=ttl_seconds) if ttl_seconds else None
        with self._lock:
            self._conn.execute(
                """
                INSERT INTO work_status_events (created_at, source, status, reason, expires_at)
                VALUES (?, ?, ?, ?, ?)
                """,
                (
                    int(now.timestamp() * 1000),
                    "manual",
                    status,
                    reason,
                    int(expires.timestamp() * 1000) if expires else None,
                ),
            )
            self._conn.commit()
        return {
            "source": "manual",
            "status": status,
            "reason": reason,
            "expiresAt": _to_iso(expires) if expires else None,
            "createdAt": _to_iso(now),
        }

    def insert_location(
        self,
        latitude: float,
        longitude: float,
        location_name: str | None,
        source: str,
        ttl_seconds: int | None,
    ) -> dict[str, Any]:
        now = _now_utc()
        expires = now + timedelta(seconds=ttl_seconds) if ttl_seconds else None
        with self._lock:
            self._conn.execute(
                """
                INSERT INTO location_events (created_at, source, lat, lon, name, expires_at)
                VALUES (?, ?, ?, ?, ?, ?)
                """,
                (
                    int(now.timestamp() * 1000),
                    source,
                    latitude,
                    longitude,
                    location_name,
                    int(expires.timestamp() * 1000) if expires else None,
                ),
            )
            self._conn.commit()
        return {
            "source": source,
            "latitude": latitude,
            "longitude": longitude,
            "name": location_name,
            "expiresAt": _to_iso(expires) if expires else None,
            "createdAt": _to_iso(now),
        }

    def latest_location_without_name(self) -> sqlite3.Row | None:
        with self._lock:
            return self._conn.execute(
                """
                SELECT *
                FROM location_events
                WHERE name IS NULL OR TRIM(name) = ''
                ORDER BY created_at DESC
                LIMIT 1
                """
            ).fetchone()

    def update_location_name(self, row_id: int, location_name: str) -> dict[str, Any] | None:
        cleaned = location_name.strip()
        if not cleaned:
            return None

        with self._lock:
            self._conn.execute(
                """
                UPDATE location_events
                SET name = ?
                WHERE id = ? AND (name IS NULL OR TRIM(name) = '')
                """,
                (cleaned, row_id),
            )
            self._conn.commit()
            row = self._conn.execute(
                "SELECT * FROM location_events WHERE id = ?",
                (row_id,),
            ).fetchone()

        return self._row_to_location_event(row) if row else None

    def latest_valid_work_event(self, target: datetime) -> sqlite3.Row | None:
        target_ms = int(target.timestamp() * 1000)
        with self._lock:
            return self._conn.execute(
                """
                SELECT *
                FROM work_status_events
                WHERE created_at <= ?
                  AND (expires_at IS NULL OR expires_at > ?)
                ORDER BY created_at DESC
                LIMIT 1
                """,
                (target_ms, target_ms),
            ).fetchone()

    def latest_work_event(self) -> sqlite3.Row | None:
        with self._lock:
            return self._conn.execute(
                "SELECT * FROM work_status_events ORDER BY created_at DESC LIMIT 1"
            ).fetchone()

    def latest_location_event(self) -> sqlite3.Row | None:
        with self._lock:
            return self._conn.execute(
                "SELECT * FROM location_events ORDER BY created_at DESC LIMIT 1"
            ).fetchone()

    def latest_valid_location_event(self, target: datetime) -> sqlite3.Row | None:
        target_ms = int(target.timestamp() * 1000)
        with self._lock:
            return self._conn.execute(
                """
                SELECT *
                FROM location_events
                WHERE created_at <= ?
                  AND (expires_at IS NULL OR expires_at > ?)
                ORDER BY created_at DESC
                LIMIT 1
                """,
                (target_ms, target_ms),
            ).fetchone()

    def cleanup_old_events(self, retention_days: int) -> dict[str, Any]:
        cutoff = _now_utc() - timedelta(days=retention_days)
        cutoff_ms = int(cutoff.timestamp() * 1000)

        with self._lock:
            deleted_work = self._conn.execute(
                "DELETE FROM work_status_events WHERE created_at < ?",
                (cutoff_ms,),
            ).rowcount
            deleted_location = self._conn.execute(
                "DELETE FROM location_events WHERE created_at < ?",
                (cutoff_ms,),
            ).rowcount
            self._conn.commit()

        return {
            "deletedWork": max(deleted_work, 0),
            "deletedLocation": max(deleted_location, 0),
            "daysToKeep": retention_days,
        }

    def location_history(self, start: datetime | None, end: datetime | None, limit: int) -> list[sqlite3.Row]:
        clauses: list[str] = []
        params: list[Any] = []
        if start:
            clauses.append("created_at >= ?")
            params.append(int(start.timestamp() * 1000))
        if end:
            clauses.append("created_at <= ?")
            params.append(int(end.timestamp() * 1000))

        where = f"WHERE {' AND '.join(clauses)}" if clauses else ""
        query = f"SELECT * FROM location_events {where} ORDER BY created_at DESC LIMIT ?"
        params.append(limit)

        with self._lock:
            return self._conn.execute(query, params).fetchall()

    def upsert_schedule(
        self,
        date_str: str,
        work_status: str | None,
        location: dict[str, Any] | None,
        reason: str | None,
        source: str,
    ) -> dict[str, Any]:
        patch: dict[str, Any] = {"source": source}
        if work_status:
            patch["workStatus"] = work_status
        if location:
            patch["location"] = location
        if reason:
            patch["reason"] = reason

        now = _now_utc()
        patch_json = json.dumps(patch)

        with self._lock:
            self._conn.execute(
                """
                INSERT INTO scheduled_status (date, patch, created_at, updated_at)
                VALUES (?, ?, ?, ?)
                ON CONFLICT(date) DO UPDATE SET patch = excluded.patch, updated_at = excluded.updated_at
                """,
                (date_str, patch_json, int(now.timestamp() * 1000), int(now.timestamp() * 1000)),
            )
            self._conn.commit()
            row = self._conn.execute(
                "SELECT * FROM scheduled_status WHERE date = ?",
                (date_str,),
            ).fetchone()

        return self._row_to_schedule(row)

    def list_schedules(self, start: str | None, end: str | None) -> list[dict[str, Any]]:
        clauses: list[str] = []
        params: list[Any] = []
        if start:
            clauses.append("date >= ?")
            params.append(start)
        if end:
            clauses.append("date <= ?")
            params.append(end)

        where = f"WHERE {' AND '.join(clauses)}" if clauses else ""
        query = f"SELECT * FROM scheduled_status {where} ORDER BY date"

        with self._lock:
            rows = self._conn.execute(query, params).fetchall()
        return [self._row_to_schedule(row) for row in rows]

    def delete_schedule(self, date_str: str) -> None:
        with self._lock:
            self._conn.execute("DELETE FROM scheduled_status WHERE date = ?", (date_str,))
            self._conn.commit()

    def get_schedule(self, date_str: str) -> dict[str, Any] | None:
        with self._lock:
            row = self._conn.execute(
                "SELECT * FROM scheduled_status WHERE date = ?",
                (date_str,),
            ).fetchone()
        return self._row_to_schedule(row) if row else None

    def holiday_cache(self, region: str, year: int) -> sqlite3.Row | None:
        with self._lock:
            return self._conn.execute(
                "SELECT * FROM bank_holidays_cache WHERE region = ? AND year = ?",
                (region, year),
            ).fetchone()

    def upsert_holiday_cache(self, region: str, year: int, payload: list[dict[str, Any]]) -> None:
        now = _now_utc()
        with self._lock:
            self._conn.execute(
                """
                INSERT INTO bank_holidays_cache (region, year, payload, fetched_at)
                VALUES (?, ?, ?, ?)
                ON CONFLICT(region, year) DO UPDATE SET
                  payload = excluded.payload,
                  fetched_at = excluded.fetched_at
                """,
                (region, year, json.dumps(payload), int(now.timestamp() * 1000)),
            )
            self._conn.commit()

    @staticmethod
    def _row_to_schedule(row: sqlite3.Row | None) -> dict[str, Any]:
        if row is None:
            return {}
        created = datetime.fromtimestamp(row["created_at"] / 1000, tz=timezone.utc)
        updated = datetime.fromtimestamp(row["updated_at"] / 1000, tz=timezone.utc)
        return {
            "date": row["date"],
            "patch": json.loads(row["patch"]),
            "createdAt": _to_iso(created),
            "updatedAt": _to_iso(updated),
        }

    @staticmethod
    def _row_to_location_event(row: sqlite3.Row | None) -> dict[str, Any]:
        if row is None:
            return {}

        created = datetime.fromtimestamp(row["created_at"] / 1000, tz=timezone.utc)
        expires_at = row["expires_at"]
        expires = (
            datetime.fromtimestamp(expires_at / 1000, tz=timezone.utc)
            if expires_at is not None
            else None
        )
        return {
            "source": row["source"],
            "latitude": row["lat"],
            "longitude": row["lon"],
            "name": row["name"],
            "expiresAt": _to_iso(expires) if expires else None,
            "createdAt": _to_iso(created),
        }


class HolidayService:
    def __init__(self, store: PersonalContextStore) -> None:
        self._store = store

    def fetch_holidays(
        self,
        region: str = "england-and-wales",
        year: int | None = None,
    ) -> list[dict[str, Any]]:
        target_year = year if year is not None else _now_utc().year
        cached = self._store.holiday_cache(region, target_year)

        if cached:
            fetched_at = datetime.fromtimestamp(cached["fetched_at"] / 1000, tz=timezone.utc)
            if fetched_at > _now_utc() - timedelta(days=1):
                return json.loads(cached["payload"])

        timeout_ms = int(_runtime_env("HOLIDAY_FETCH_TIMEOUT_MS", default="5000") or "5000")
        timeout_s = max(timeout_ms, 1) / 1000

        try:
            request = Request(HOLIDAY_URL, method="GET")
            with urlopen(request, timeout=timeout_s) as response:
                payload = json.loads(response.read().decode("utf-8"))
            if region not in payload:
                raise ValueError(f"Region {region} not found in holiday data")

            events = payload[region]["events"]
            self._store.upsert_holiday_cache(region, target_year, events)
            return events
        except (URLError, ValueError, TimeoutError, json.JSONDecodeError):
            if cached:
                return json.loads(cached["payload"])
            raise

    def is_bank_holiday(self, target: datetime, region: str = "england-and-wales") -> bool:
        try:
            holidays = self.fetch_holidays(region, year=target.year)
        except Exception:
            return False

        date_str = target.strftime("%Y-%m-%d")
        return any(item.get("date") == date_str for item in holidays)


class StatusResolver:
    def __init__(self, store: PersonalContextStore, holidays: HolidayService) -> None:
        self._store = store
        self._holidays = holidays

    def resolve(self, target: datetime | None = None) -> dict[str, Any]:
        date = (target or _now_utc()).astimezone(timezone.utc)
        date_str = date.strftime("%Y-%m-%d")
        now = _now_utc()
        is_current_date = date_str == now.strftime("%Y-%m-%d")

        is_weekend = date.weekday() >= 5
        is_holiday = self._holidays.is_bank_holiday(date)

        base_work_event = self._store.latest_valid_work_event(date)

        work_status = base_work_event["status"] if base_work_event else "off"
        work_status_provenance: dict[str, Any] = {"source": "baseline"}
        reason = None
        if base_work_event:
            work_status_provenance = {
                "source": "work-status-event",
                "eventSource": base_work_event["source"],
            }
            reason = base_work_event["reason"]

        if is_weekend or is_holiday:
            work_status = "off"
            work_status_provenance = {"source": "baseline"}
            reason = None

        schedule = self._store.get_schedule(date_str)
        patch = schedule.get("patch") if schedule else None
        if patch and patch.get("workStatus"):
            work_status = patch["workStatus"]
            work_status_provenance = {
                "source": "scheduled-context",
                "scheduledContextSource": patch.get("source", "manual"),
            }
            reason = patch.get("reason")

        if is_current_date:
            latest = self._store.latest_valid_work_event(now)
            if latest:
                work_status = latest["status"]
                work_status_provenance = {
                    "source": "work-status-event",
                    "eventSource": latest["source"],
                }
                reason = latest["reason"]

        location = None
        location_provenance: dict[str, Any] = {"source": "none"}
        schedule_location = patch.get("location") if patch and patch.get("location") else None
        latest_location_event = self._store.latest_valid_location_event(now) if is_current_date else None
        if latest_location_event:
            created = datetime.fromtimestamp(latest_location_event["created_at"] / 1000, tz=timezone.utc)
            stale_hours = float(_runtime_env("LOCATION_STALE_HOURS", default="6") or "6")
            stale_window = timedelta(hours=stale_hours if stale_hours > 0 else 6)
            source = latest_location_event["source"]

            stale = now - created > stale_window
            if source in VALID_LOCATION_SOURCES and not stale:
                location = _effective_location_payload(LocationRecord(
                    latitude=latest_location_event["lat"],
                    longitude=latest_location_event["lon"],
                    locationName=latest_location_event["name"],
                    source=source,
                    timestamp=_to_iso(created),
                ).__dict__)
                location_provenance = {
                    "source": "location-event",
                    "eventSource": source,
                }
        if location is None and schedule_location:
            location = _effective_location_payload(schedule_location)
            location_provenance = {
                "source": "scheduled-context",
                "scheduledContextSource": patch.get("source", "manual"),
            }

        last_updated = _to_iso(now)
        if base_work_event:
            created = datetime.fromtimestamp(base_work_event["created_at"] / 1000, tz=timezone.utc)
            last_updated = _to_iso(created)

        return {
            "effectiveDate": date_str,
            "resolvedAt": _to_iso(now),
            "bankHoliday": is_holiday,
            "weekend": is_weekend,
            "workStatus": work_status,
            "location": location,
            "reason": reason,
            "workStatusProvenance": work_status_provenance,
            "locationProvenance": location_provenance,
            "lastUpdated": last_updated,
        }


def _load_api_keys() -> list[str]:
    if _auth_is_disabled():
        return []
    keys: list[str] = []
    service_key = _runtime_env("PERSONAL_CONTEXT_MCP_API_KEY")
    if service_key:
        keys.append(service_key.strip())
    single = _runtime_env("MCP_API_KEY")
    if single:
        keys.append(single.strip())

    multi = _runtime_env("MCP_API_KEYS")
    if multi:
        for raw in multi.split(","):
            token = raw.strip()
            if token:
                keys.append(token)

    return list(dict.fromkeys(keys))


def _auth_is_disabled() -> bool:
    return _runtime_env("API_KEY_MODE", "PERSONAL_API_KEY_MODE", default="").strip().lower() == "disabled"


def _health_auth_mode() -> str:
    if _auth_is_disabled():
        return "disabled"
    if api_keys:
        return "bearer-token"
    return "unconfigured"


def _health_payload(database_path: str) -> dict[str, Any]:
    payload = {
        "status": "ok",
        "server": "personal-context-mcp",
        "databasePath": database_path,
        "mcpAuthMode": _health_auth_mode(),
        "googleApiConfigured": bool(_runtime_env("GOOGLE_API_KEY", "PERSONAL_GOOGLE_API_KEY")),
        "googlePollCron": _runtime_env("GOOGLE_POLL_CRON", "PERSONAL_GOOGLE_POLL_CRON"),
        "homeAssistantConfigured": bool(
            _runtime_env("HA_URL") and _runtime_env("HA_TOKEN") and _runtime_env("HA_ENTITY_ID")
        ),
        "locationStaleHours": _runtime_env("LOCATION_STALE_HOURS", default="6"),
        "holidayFetchTimeoutMs": _runtime_env("HOLIDAY_FETCH_TIMEOUT_MS", default="5000"),
    }
    payload["googleRuntime"] = google_maps.status()
    payload["homeAssistantRuntime"] = home_assistant.status()
    payload["runtimeJobs"] = source_manager.status()
    return payload


database_path = _resolve_database_path()
store = PersonalContextStore(database_path)
holidays = HolidayService(store)
resolver = StatusResolver(store, holidays)
google_maps = GoogleMapsService()
home_assistant = HomeAssistantConnector(store, google_maps)
source_manager = RuntimeSourceManager(store, google_maps, home_assistant)

api_keys = _load_api_keys()
auth = None if _auth_is_disabled() else StaticApiKeyVerifier(api_keys, base_url=_runtime_env("BASE_URL"))

@lifespan
async def runtime_lifespan(_server):
    source_manager.start()
    try:
        yield {}
    finally:
        source_manager.stop()


server = FastMCP("personal-context-mcp", auth=auth, lifespan=runtime_lifespan)
mcp = server


@server.custom_route("/", methods=["GET", "HEAD"], include_in_schema=False)
async def root_health(_request):
    return JSONResponse(_health_payload(database_path))


@server.custom_route("/health", methods=["GET", "HEAD"], include_in_schema=False)
async def health(_request):
    return JSONResponse(_health_payload(database_path))


@server.custom_route("/healthz", methods=["GET", "HEAD"], include_in_schema=False)
async def healthz(_request):
    return JSONResponse(_health_payload(database_path))


@server.tool
def status_get(date: str | None = None) -> dict[str, Any]:
    target = _parse_date(date) if date else None
    return resolver.resolve(target)


@server.tool
def status_get_work(date: str | None = None) -> dict[str, Any]:
    target = _parse_date(date) if date else None
    resolved = resolver.resolve(target)
    return {
        "workStatus": resolved["workStatus"],
        "effectiveDate": resolved["effectiveDate"],
    }


@server.tool
def status_set_work(
    workStatus: str,
    reason: str | None = None,
    ttlSeconds: int | None = None,
) -> dict[str, Any]:
    store.insert_work_status(workStatus, reason, ttlSeconds)
    resolved = resolver.resolve()
    return {
        "workStatus": resolved["workStatus"],
        "effectiveDate": resolved["effectiveDate"],
    }


@server.tool
def status_get_location() -> dict[str, Any]:
    resolved = resolver.resolve()
    return {
        "location": resolved["location"],
        "effectiveDate": resolved["effectiveDate"],
    }


@server.tool
def status_set_location(
    latitude: float,
    longitude: float,
    locationName: str | None = None,
    source: str = "manual",
    ttlSeconds: int | None = None,
) -> dict[str, Any]:
    if source not in VALID_LOCATION_SOURCES:
        raise ValueError("Invalid location source")
    if source != "manual":
        raise ValueError("Public location writes must use manual source")
    resolved_name = google_maps.enrich_name(latitude, longitude, locationName)
    store.insert_location(latitude, longitude, resolved_name, source, ttlSeconds)
    resolved = resolver.resolve()
    return {
        "location": resolved["location"],
        "effectiveDate": resolved["effectiveDate"],
    }


@server.tool
def status_sync_homeassistant_location() -> dict[str, Any]:
    record = source_manager.poll_homeassistant_now()
    resolved = resolver.resolve()
    return {
        "configured": home_assistant.configured,
        "synced": bool(record),
        "record": record,
        "location": resolved["location"],
        "effectiveDate": resolved["effectiveDate"],
    }


@server.tool
def status_enrich_latest_location() -> dict[str, Any]:
    record = source_manager.enrich_latest_location_now()
    resolved = resolver.resolve()
    return {
        "configured": google_maps.configured,
        "updated": bool(record),
        "record": record,
        "location": resolved["location"],
        "effectiveDate": resolved["effectiveDate"],
    }


def _resolve_nearby_search_origin(
    latitude: float | None,
    longitude: float | None,
) -> tuple[float, float, str]:
    if latitude is None and longitude is None:
        resolved = resolver.resolve()
        location = resolved.get("location")
        if not location:
            raise ValueError("No current location is available; provide latitude and longitude explicitly")

        return (
            float(location["latitude"]),
            float(location["longitude"]),
            str(location.get("source") or "current"),
        )

    if latitude is None or longitude is None:
        raise ValueError("latitude and longitude must both be provided")

    return (float(latitude), float(longitude), "explicit")


@server.tool
def places_nearby(
    latitude: float | None = None,
    longitude: float | None = None,
    radiusMeters: int = 500,
    maxResults: int = 5,
    includedTypes: list[str] | None = None,
    rankPreference: str = "POPULARITY",
) -> dict[str, Any]:
    search_latitude, search_longitude, origin_source = _resolve_nearby_search_origin(latitude, longitude)
    result = google_maps.nearby_places(
        latitude=search_latitude,
        longitude=search_longitude,
        radius_meters=radiusMeters,
        max_results=maxResults,
        included_types=includedTypes or list(DEFAULT_NEARBY_PLACE_TYPES),
        rank_preference=rankPreference,
    )
    result["origin"] = {
        "latitude": search_latitude,
        "longitude": search_longitude,
        "source": origin_source,
    }
    result["defaultsApplied"] = includedTypes is None
    return result


@server.tool
def status_get_location_history(
    from_: Annotated[str | None, Field(alias="from")] = None,
    to: str | None = None,
    limit: int | None = None,
) -> dict[str, Any]:
    if limit is not None and limit < 1:
        raise ValueError("limit must be at least 1")
    start = _parse_optional_datetime(from_, "from")
    end = _parse_optional_datetime(to, "to")
    rows = store.location_history(start, end, limit or 50)

    events = []
    for row in rows:
        created = datetime.fromtimestamp(row["created_at"] / 1000, tz=timezone.utc)
        events.append(
            {
                "latitude": row["lat"],
                "longitude": row["lon"],
                "locationName": row["name"],
                "source": row["source"],
                "timestamp": _to_iso(created),
            }
        )

    return {"events": events}


@server.tool
def status_schedule_set(
    date: str,
    workStatus: str | None = None,
    location: dict[str, Any] | None = None,
    reason: str | None = None,
    source: str = "manual",
) -> dict[str, Any]:
    if not DATE_RE.match(date):
        raise ValueError("Invalid date format. Use YYYY-MM-DD")
    if not workStatus and not location:
        raise ValueError("Scheduled context must include workStatus, location, or both")
    if source not in VALID_SCHEDULED_CONTEXT_SOURCES:
        raise ValueError("Invalid scheduled context source")
    if source != "manual":
        raise ValueError("Public scheduled-context writes must use manual source")
    normalized_location = _normalize_scheduled_location(location) if location else None
    store.upsert_schedule(date, workStatus, normalized_location, reason, source)
    return {"success": True}


@server.tool
def status_schedule_list(
    from_: Annotated[str | None, Field(alias="from")] = None,
    to: str | None = None,
) -> list[dict[str, Any]]:
    return store.list_schedules(from_, to)


@server.tool
def status_schedule_delete(date: str) -> dict[str, Any]:
    store.delete_schedule(date)
    return {"success": True}


@server.tool
def holidays_list(region: str | None = None) -> list[dict[str, Any]]:
    return holidays.fetch_holidays(region or "england-and-wales")


def main() -> None:
    transport_name = _runtime_env("FASTMCP_TRANSPORT", default="streamable-http").lower()
    if transport_name == "http":
        transport_name = "streamable-http"

    if transport_name == "stdio":
        server.run()
    else:
        host = _runtime_env("HOST", default="127.0.0.1")
        port = int(_runtime_env("PORT", default="3003"))
        path = _runtime_env("MCP_PATH", default="/mcp")
        server.run(
            transport=transport_name,
            host=host,
            port=port,
            path=path,
            show_banner=False,
        )


if __name__ == "__main__":
    main()
