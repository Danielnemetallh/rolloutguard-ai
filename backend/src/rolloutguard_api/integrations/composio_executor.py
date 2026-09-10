"""Composio execution after Freigeben. File fallback when no key (CI)."""

from __future__ import annotations

import json
from datetime import UTC, datetime
from email.message import EmailMessage
from pathlib import Path
from typing import Any

from rolloutguard_api.core.config import get_settings
from rolloutguard_api.core.logging import get_logger
from rolloutguard_api.db import models

log = get_logger(__name__)


CALENDAR_NAME = "RolloutGuard / SLA-Risiko"

CALENDAR_COLOR = "7"

TOOLKITS = ["gmail", "googlecalendar", "notion"]


_session_cache: dict[str, Any] = {}


def _actions_dir() -> Path:

    path = Path(get_settings().upload_dir) / "actions"

    path.mkdir(parents=True, exist_ok=True)

    return path


def _write_ics(action: models.ProposedAction) -> dict[str, Any]:

    payload = action.payload_json or {}

    stamp = datetime.now(UTC).strftime("%Y%m%dT%H%M%SZ")

    date_value = str(payload.get("date") or payload.get("start") or "20260915").replace("-", "")

    if "T" not in date_value:
        date_value = date_value[:8]

        dt = f"{date_value}T090000Z"

    else:
        dt = date_value

    title = str(payload.get("title") or "RolloutGuard Termin")

    body = (
        "BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//RolloutGuard//DE\r\n"
        f"X-WR-CALNAME:{CALENDAR_NAME}\r\n"
        "BEGIN:VEVENT\r\n"
        f"UID:rg-{action.id}@rolloutguard\r\nDTSTAMP:{stamp}\r\n"
        f"DTSTART:{dt}\r\nSUMMARY:{title}\r\n"
        f"DESCRIPTION:{payload.get('description') or ''}\r\n"
        "END:VEVENT\r\nEND:VCALENDAR\r\n"
    )

    dest = _actions_dir() / f"action-{action.id}.ics"

    dest.write_text(body, encoding="utf-8")

    return {"channel": "ics", "path": str(dest), "calendar": CALENDAR_NAME}


def _write_eml(action: models.ProposedAction) -> dict[str, Any]:

    payload = action.payload_json or {}

    msg = EmailMessage()

    msg["Subject"] = str(payload.get("subject") or "RolloutGuard Hinweis")

    msg["From"] = "analystin@rolloutguard.demo"

    msg["To"] = str(payload.get("to") or "partner@nordturm.demo")

    msg.set_content(str(payload.get("body") or ""))

    dest = _actions_dir() / f"action-{action.id}.eml"

    dest.write_bytes(msg.as_bytes())

    return {"channel": "eml", "path": str(dest)}


def _write_board(action: models.ProposedAction) -> dict[str, Any]:

    dest = _actions_dir() / f"action-{action.id}.board.json"

    dest.write_text(
        json.dumps(action.payload_json or {}, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )

    return {"channel": "in_app_board", "path": str(dest)}


def _file_fallback(action: models.ProposedAction) -> dict[str, Any]:

    if action.action_type in {"calendar", "digest"}:
        return _write_ics(action)

    if action.action_type in {"email", "briefing"}:
        return _write_eml(action)

    if action.action_type in {"board", "task"}:
        return _write_board(action)

    if action.action_type in {"watch", "watch_fire", "override"}:
        return {"channel": "in_app", "ok": True}

    return {"channel": "in_app", "ok": True}


def _coerce_json(value: Any) -> Any:

    if isinstance(value, (str, int, float, bool)) or value is None:
        return value

    if isinstance(value, dict):
        return {str(k): _coerce_json(v) for k, v in value.items()}

    if isinstance(value, (list, tuple)):
        return [_coerce_json(v) for v in value]

    return str(value)


def _composio_sdk_installed() -> bool:

    try:
        import composio  # noqa: F401

        return True

    except ImportError:
        return False


def _composio_configured() -> bool:

    return bool(get_settings().composio_api_key.strip()) and _composio_sdk_installed()


def _session_ready() -> bool:

    return get_settings().composio_user_id in _session_cache


def _get_or_create_session() -> Any:

    settings = get_settings()

    cache_key = settings.composio_user_id

    cached = _session_cache.get(cache_key)

    if cached is not None:
        return cached

    from composio import Composio

    composio = Composio(api_key=settings.composio_api_key)

    session = composio.sessions.create(user_id=settings.composio_user_id, toolkits=TOOLKITS)

    _session_cache[cache_key] = session

    return session


def _probe_oauth_needed(session: Any) -> bool:

    for toolkit in TOOLKITS:
        try:
            request = session.authorize(toolkit)

            if request.redirect_url:
                return True

        except Exception:  # noqa: BLE001
            continue

    return False


def bootstrap_composio() -> None:
    """Warm Composio session on API startup when configured."""

    if not _composio_configured():
        return

    try:
        _get_or_create_session()

        log.info("composio_ready", user_id=get_settings().composio_user_id)

    except Exception as exc:  # noqa: BLE001
        log.warning("composio_bootstrap_failed", error=type(exc).__name__)


def _notion_arguments(payload: dict[str, Any]) -> dict[str, Any]:

    settings = get_settings()

    args: dict[str, Any] = {
        "title": payload.get("title") or "Ausnahme",
        "content": payload.get("body") or payload.get("description") or "",
    }

    if settings.composio_notion_database_id.strip():
        args["database_id"] = settings.composio_notion_database_id.strip()

    return args


def _composio_execute(action: models.ProposedAction) -> dict[str, Any]:

    if not _composio_sdk_installed():
        return {**_file_fallback(action), "note": "composio_not_installed"}

    session = _get_or_create_session()

    payload = action.payload_json or {}

    if action.action_type in {"email", "briefing"}:
        result = session.execute(
            "GMAIL_CREATE_EMAIL_DRAFT",
            arguments={
                "recipient_email": payload.get("to") or "partner@nordturm.demo",
                "subject": payload.get("subject") or "RolloutGuard",
                "body": payload.get("body") or "",
            },
        )

        return {
            "channel": "composio",
            "tool": "GMAIL_CREATE_EMAIL_DRAFT",
            "result": _coerce_json(result),
        }

    if action.action_type in {"calendar", "digest"}:
        result = session.execute(
            "GOOGLECALENDAR_CREATE_EVENT",
            arguments={
                "summary": payload.get("title") or "RolloutGuard Termin",
                "start_datetime": payload.get("date") or payload.get("start"),
                "description": payload.get("description") or "",
                "calendar_name": CALENDAR_NAME,
                "color_id": CALENDAR_COLOR,
                "event_duration_hour": 1,
            },
        )

        return {
            "channel": "composio",
            "tool": "GOOGLECALENDAR_CREATE_EVENT",
            "result": _coerce_json(result),
        }

    if action.action_type in {"board", "task"}:
        result = session.execute(
            "NOTION_CREATE_PAGE",
            arguments=_notion_arguments(payload),
        )

        board = _write_board(action)

        return {
            "channel": "composio",
            "tool": "NOTION_CREATE_PAGE",
            "result": _coerce_json(result),
            "in_app": board,
        }

    return _file_fallback(action)


def execute_confirmed(action: models.ProposedAction) -> dict[str, Any]:

    settings = get_settings()

    if not settings.composio_api_key.strip():
        return _file_fallback(action)

    try:
        return _composio_execute(action)

    except Exception as exc:  # noqa: BLE001
        log.warning("composio_execute_failed", error=type(exc).__name__)

        fallback = _file_fallback(action)

        fallback["composio_error"] = type(exc).__name__

        fallback["error"] = "composio_execute_failed"

        return fallback


def integration_status() -> dict[str, Any]:

    settings = get_settings()

    has_key = bool(settings.composio_api_key.strip())

    sdk = _composio_sdk_installed()

    configured = has_key and sdk

    session_ready = _session_ready()

    oauth_needed = False

    session: Any | None = _session_cache.get(settings.composio_user_id)

    if configured and not session_ready:
        try:
            session = _get_or_create_session()

            session_ready = True

        except Exception as exc:  # noqa: BLE001
            log.debug("composio_status_session_probe_failed", error=type(exc).__name__)

    if session_ready and session is not None:
        try:
            oauth_needed = _probe_oauth_needed(session)

        except Exception:  # noqa: BLE001
            oauth_needed = True

    connected = session_ready and not oauth_needed

    mode = "live" if session_ready else "file_fallback"

    if not has_key:
        hint = "COMPOSIO_API_KEY in .env setzen und API neu starten (scripts/dev-api.ps1)."

    elif not sdk:
        hint = "Composio-SDK fehlt — im backend-Ordner: uv sync, dann API neu starten."

    elif not session_ready:
        hint = "Composio-Key ungültig oder Session fehlgeschlagen — Key prüfen und API neu starten."

    elif oauth_needed:
        hint = "Composio verbinden, um Gmail, Kalender und Notion per OAuth zu verknüpfen."

    else:
        hint = "Composio ist bereit. Freigeben nutzt Live-Ausführung."

    return {
        "composio_configured": has_key,
        "composio_sdk_installed": sdk,
        "user_id": settings.composio_user_id,
        "toolkits": TOOLKITS,
        "mode": mode,
        "calendar": CALENDAR_NAME,
        "connected": connected,
        "session_ready": session_ready,
        "oauth_needed": oauth_needed,
        "connect_hint": hint,
    }


def connect_link() -> dict[str, Any]:

    settings = get_settings()

    if not settings.composio_api_key.strip():
        return {
            "url": None,
            "mode": "file_fallback",
            "message": "Kein COMPOSIO_API_KEY — .env prüfen und API neu starten.",
        }

    if not _composio_sdk_installed():
        return {
            "url": None,
            "mode": "error",
            "message": "Composio-Paket nicht installiert — im backend-Ordner: uv sync",
        }

    try:
        session = _get_or_create_session()

        for toolkit in TOOLKITS:
            try:
                request = session.authorize(toolkit)

                if request.redirect_url:
                    return {
                        "url": request.redirect_url,
                        "mode": "live",
                        "user_id": settings.composio_user_id,
                        "toolkit": toolkit,
                    }

            except Exception:  # noqa: BLE001
                continue

        return {
            "url": None,
            "mode": "live",
            "connected": True,
            "message": "Composio ist verbunden — keine weitere OAuth-Verknüpfung nötig.",
        }

    except Exception as exc:  # noqa: BLE001
        return {"url": None, "mode": "error", "message": type(exc).__name__}
