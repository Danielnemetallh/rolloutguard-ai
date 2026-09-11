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
    date_value = str(
        payload.get("date") or payload.get("start") or payload.get("start_datetime") or "20260915"
    ).replace("-", "")
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
    msg["To"] = str(payload.get("to") or payload.get("recipient_email") or "partner@nordturm.demo")
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
    key = get_settings().composio_api_key.strip()
    if not key:
        return False
    if key.startswith("ck_"):
        return True
    return _composio_sdk_installed()


def _auth_headers_for_key(api_key: str) -> dict[str, str]:
    """Connect keys (ck_) use a different header than project keys (ak_)."""
    key = api_key.strip()
    if key.startswith("ck_"):
        return {"x-consumer-api-key": key}
    return {"x-api-key": key}


def _install_composio_auth() -> None:
    from composio.client import HttpClient

    if getattr(HttpClient, "_rg_auth_patched", False):
        return

    def auth_headers(self) -> dict[str, str]:
        api_key = getattr(self, "api_key", None)
        if not api_key:
            return {}
        return _auth_headers_for_key(str(api_key))

    HttpClient.auth_headers = property(auth_headers)  # type: ignore[method-assign]
    HttpClient._rg_auth_patched = True  # type: ignore[attr-defined]


def _composio_client() -> Any:
    cached = _session_cache.get("client")
    if cached is not None:
        return cached
    from composio import Composio

    _install_composio_auth()
    client = Composio(
        api_key=get_settings().composio_api_key.strip(),
        toolkit_versions="latest",
    )
    _session_cache["client"] = client
    return client


def _get_or_create_session() -> Any:
    """Compatibility alias used by tests; returns the Composio client."""
    return _composio_client()


def _account_items(listed: Any) -> list[Any]:
    items = getattr(listed, "items", None)
    if items is None and isinstance(listed, dict):
        items = listed.get("items")
    return list(items or [])


def _account_toolkit(item: Any) -> str:
    toolkit = getattr(item, "toolkit", None)
    if toolkit is None and isinstance(item, dict):
        toolkit = item.get("toolkit")
    slug = toolkit.get("slug") if isinstance(toolkit, dict) else getattr(toolkit, "slug", None)
    return str(slug or "").lower()


def _account_status(item: Any) -> str:
    status = getattr(item, "status", None)
    if status is None and isinstance(item, dict):
        status = item.get("status")
    return str(status or "").upper()


def _account_user_id(item: Any) -> str:
    uid = getattr(item, "user_id", None) or getattr(item, "userId", None)
    if uid is None and isinstance(item, dict):
        uid = item.get("user_id") or item.get("userId")
    return str(uid or "")


def _list_connected_accounts() -> list[Any]:
    listed = _composio_client().connected_accounts.list(limit=50)
    return _account_items(listed)


def _active_toolkits() -> set[str]:
    return {
        _account_toolkit(item)
        for item in _list_connected_accounts()
        if _account_status(item) in {"ACTIVE", "CONNECTED"} and _account_toolkit(item)
    }


def _execute_user_id() -> str:
    settings = get_settings()
    preferred = settings.composio_user_id
    try:
        accounts = _list_connected_accounts()
    except Exception:  # noqa: BLE001
        return preferred
    if any(_account_user_id(item) == preferred for item in accounts):
        return preferred
    for item in accounts:
        if _account_status(item) in {"ACTIVE", "CONNECTED"} and _account_user_id(item):
            return _account_user_id(item)
    return preferred


def bootstrap_composio() -> None:
    """Warm Composio on API startup when configured."""
    if not _composio_configured():
        return
    try:
        if _is_connect_key():
            from rolloutguard_api.integrations.composio_connect import ping_connect

            ok = ping_connect(get_settings().composio_api_key.strip())
            log.info("composio_connect_ready" if ok else "composio_connect_not_ready")
            return
        _composio_client()
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


def _tool_arguments(payload: dict[str, Any]) -> dict[str, Any]:
    skip = {"composio_tool", "site_id", "title", "milestone_kind"}
    return {key: value for key, value in payload.items() if key not in skip and value is not None}


def _read_fallback(name: str) -> dict[str, Any]:
    if "CALENDAR" in name:
        return {
            "connected": False,
            "events": [],
            "message": (
                "Google Calendar is not available right now. "
                "Do not invent appointments or mention tool names."
            ),
        }
    if "GMAIL" in name:
        return {
            "connected": False,
            "emails": [],
            "message": "Gmail is not available. Do not name tools or error types.",
        }
    if "NOTION" in name:
        return {
            "connected": False,
            "pages": [],
            "message": "Notion is not available. Do not name tools or error types.",
        }
    return {
        "connected": False,
        "message": "The connected account is not available. Do not name tools or error types.",
    }


def _is_connect_key() -> bool:
    return get_settings().composio_api_key.strip().startswith("ck_")


def _tools_execute(name: str, arguments: dict[str, Any]) -> Any:
    from rolloutguard_api.integrations.composio_connect import execute_connect_tool

    if _is_connect_key():
        return execute_connect_tool(
            name,
            arguments,
            api_key=get_settings().composio_api_key.strip(),
        )
    client = _composio_client()
    return client.tools.execute(
        name,
        arguments=arguments,
        user_id=_execute_user_id(),
        dangerously_skip_version_check=True,
    )


def execute_composio_tool(name: str, arguments: dict[str, Any] | None = None) -> dict[str, Any]:
    """Run a named Composio tool via connected accounts (reads, or writes after Freigeben)."""
    args = arguments or {}
    if not _composio_configured():
        return _read_fallback(name)
    try:
        result = _tools_execute(name, args)
        if isinstance(result, dict) and result.get("connected") is False:
            return {**result, "channel": "composio"}
        coerced = _coerce_json(result)
        if isinstance(coerced, dict) and (
            "events" in coerced or "emails" in coerced or "pages" in coerced
        ):
            return {"channel": "composio", "connected": True, **coerced}
        return {
            "channel": "composio",
            "connected": True,
            "result": coerced,
        }
    except Exception as exc:  # noqa: BLE001
        log.warning("composio_tool_failed", tool=name, error=type(exc).__name__)
        return _read_fallback(name)


def _composio_execute(action: models.ProposedAction) -> dict[str, Any]:
    payload = action.payload_json or {}
    named = str(payload.get("composio_tool") or "")
    if named:
        if not _composio_configured():
            return {
                **_file_fallback(action),
                "tool": named,
                "note": "composio_not_configured",
            }
        return execute_composio_tool(named, _tool_arguments(payload))
    if not _composio_sdk_installed():
        return {**_file_fallback(action), "note": "composio_not_installed"}
    if action.action_type in {"email", "briefing"}:
        result = _tools_execute(
            "GMAIL_CREATE_EMAIL_DRAFT",
            {
                "recipient_email": payload.get("to") or "partner@nordturm.demo",
                "subject": payload.get("subject") or "RolloutGuard",
                "body": payload.get("body") or "",
            },
        )
        return {"channel": "composio", "result": _coerce_json(result)}
    if action.action_type in {"calendar", "digest"}:
        result = _tools_execute(
            "GOOGLECALENDAR_CREATE_EVENT",
            {
                "summary": payload.get("title") or "RolloutGuard Termin",
                "start_datetime": payload.get("date") or payload.get("start"),
                "description": payload.get("description") or "",
                "calendar_name": CALENDAR_NAME,
                "color_id": CALENDAR_COLOR,
                "event_duration_hour": 1,
            },
        )
        return {"channel": "composio", "result": _coerce_json(result)}
    if action.action_type in {"board", "task"}:
        result = _tools_execute("NOTION_CREATE_PAGE", _notion_arguments(payload))
        board = _write_board(action)
        return {"channel": "composio", "result": _coerce_json(result), "in_app": board}
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


def _auth_config_id(client: Any, toolkit: str) -> str | None:
    try:
        listed = client.auth_configs.list(toolkit=toolkit)
    except Exception:  # noqa: BLE001
        return None
    items = _account_items(listed)
    if not items:
        return None
    first = items[0]
    return str(getattr(first, "id", None) or getattr(first, "nanoid", None) or "") or None


def integration_status() -> dict[str, Any]:
    settings = get_settings()
    has_key = bool(settings.composio_api_key.strip())
    sdk = _composio_sdk_installed()
    session_ready = False
    oauth_needed = False
    connected_toolkits: list[str] = []
    if has_key and _is_connect_key():
        from rolloutguard_api.integrations.composio_connect import (
            list_connect_toolkits,
            ping_connect,
        )

        session_ready = ping_connect(settings.composio_api_key.strip())
        if session_ready:
            connected_toolkits = sorted(list_connect_toolkits(settings.composio_api_key.strip()))
            oauth_needed = not all(name in connected_toolkits for name in TOOLKITS)
    elif has_key and sdk:
        try:
            _composio_client()
            session_ready = True
            try:
                connected_toolkits = sorted(_active_toolkits())
            except Exception as exc:  # noqa: BLE001
                log.debug("composio_status_accounts_failed", error=type(exc).__name__)
                connected_toolkits = []
            oauth_needed = not all(name in connected_toolkits for name in TOOLKITS)
        except Exception as exc:  # noqa: BLE001
            log.debug("composio_status_probe_failed", error=type(exc).__name__)
            session_ready = False
            oauth_needed = True
    connected = session_ready and not oauth_needed
    mode = "live" if connected else "file_fallback"
    if not has_key:
        hint = "COMPOSIO_API_KEY in .env setzen und API neu starten (scripts/dev-api.ps1)."
    elif not session_ready:
        hint = "Composio Connect antwortet nicht. Key und API-Neustart prüfen."
    elif oauth_needed:
        missing = [name for name in TOOLKITS if name not in connected_toolkits]
        hint = "In Composio verbinden: " + ", ".join(missing)
    elif not sdk and not _is_connect_key():
        hint = "Composio-SDK fehlt — im backend-Ordner: uv sync, dann API neu starten."
    else:
        hint = "Composio ist bereit (Gmail, Kalender, Notion)."
    return {
        "composio_configured": has_key,
        "composio_sdk_installed": sdk,
        "user_id": settings.composio_user_id,
        "toolkits": TOOLKITS,
        "connected_toolkits": connected_toolkits,
        "mode": mode,
        "calendar": CALENDAR_NAME,
        "connected": connected,
        "session_ready": session_ready,
        "oauth_needed": oauth_needed,
        "connect_hint": hint,
        "auth_mode": "connect" if _is_connect_key() else "project",
    }


def connect_link() -> dict[str, Any]:
    settings = get_settings()
    if not settings.composio_api_key.strip():
        return {
            "url": None,
            "mode": "file_fallback",
            "message": "Kein COMPOSIO_API_KEY — .env prüfen und API neu starten.",
        }
    try:
        if _is_connect_key():
            from rolloutguard_api.integrations.composio_connect import (
                list_connect_toolkits,
                start_connect_auth,
            )

            key = settings.composio_api_key.strip()
            connected = list_connect_toolkits(key)
            for toolkit in TOOLKITS:
                if toolkit in connected:
                    continue
                result = start_connect_auth(key, toolkit)
                url = _redirect_from_result(result)
                if url:
                    return {
                        "url": url,
                        "mode": "live",
                        "toolkit": toolkit,
                    }
            return {
                "url": None,
                "mode": "live",
                "connected": True,
                "message": "Composio Connect ist verbunden.",
            }
        if not _composio_sdk_installed():
            return {
                "url": None,
                "mode": "error",
                "message": "Composio-Paket nicht installiert — im backend-Ordner: uv sync",
            }
        client = _composio_client()
        for toolkit in TOOLKITS:
            auth_id = _auth_config_id(client, toolkit)
            if not auth_id:
                continue
            request = client.connected_accounts.link(settings.composio_user_id, auth_id)
            if request.redirect_url:
                return {
                    "url": request.redirect_url,
                    "mode": "live",
                    "user_id": settings.composio_user_id,
                    "toolkit": toolkit,
                }
        return {
            "url": None,
            "mode": "live",
            "connected": True,
            "message": "Composio ist verbunden — keine weitere OAuth-Verknüpfung nötig.",
        }
    except Exception as exc:  # noqa: BLE001
        return {"url": None, "mode": "error", "message": type(exc).__name__}


def _redirect_from_result(result: Any) -> str | None:
    if not isinstance(result, dict):
        return None
    for key in ("redirect_url", "redirectUrl", "url"):
        value = result.get(key)
        if isinstance(value, str) and value.startswith("http"):
            return value
    data = result.get("data")
    if isinstance(data, dict):
        return _redirect_from_result(data)
    blob = json.dumps(result)
    if "http" in blob:
        for token in blob.replace('"', " ").replace("'", " ").split():
            if token.startswith("http"):
                return token.rstrip(".,")
    return None
