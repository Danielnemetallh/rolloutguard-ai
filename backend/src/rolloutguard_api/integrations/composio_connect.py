"""Execute tools with a Composio Connect (ck_) key via MCP.

Connect keys are not project API keys. backend.composio.dev rejects them.
The working endpoint is https://connect.composio.dev/mcp with x-consumer-api-key.
"""

from __future__ import annotations

import json
from typing import Any

import httpx

from rolloutguard_api.core.logging import get_logger

log = get_logger(__name__)

CONNECT_MCP_URL = "https://connect.composio.dev/mcp"
TOOLKITS = ["gmail", "googlecalendar", "notion"]

# Agent-facing names -> current Composio slugs (tried in order).
TOOL_SLUGS: dict[str, list[str]] = {
    "GOOGLECALENDAR_LIST_EVENTS": [
        "GOOGLECALENDAR_EVENTS_LIST",
        "GOOGLECALENDAR_EVENTS_LIST_ALL_CALENDARS",
        "GOOGLECALENDAR_LIST_EVENTS",
    ],
    "GOOGLECALENDAR_FIND_EVENT": ["GOOGLECALENDAR_FIND_EVENT"],
    "GOOGLECALENDAR_GET_CURRENT_DATE_TIME": ["GOOGLECALENDAR_GET_CURRENT_DATE_TIME"],
    "GOOGLECALENDAR_CREATE_EVENT": ["GOOGLECALENDAR_CREATE_EVENT"],
    "GOOGLECALENDAR_UPDATE_EVENT": ["GOOGLECALENDAR_UPDATE_EVENT", "GOOGLECALENDAR_PATCH_EVENT"],
    "GOOGLECALENDAR_DELETE_EVENT": ["GOOGLECALENDAR_DELETE_EVENT", "GOOGLECALENDAR_EVENTS_DELETE"],
    "GMAIL_FETCH_EMAILS": ["GMAIL_FETCH_EMAILS"],
    "GMAIL_GET_PROFILE": ["GMAIL_GET_PROFILE"],
    "GMAIL_CREATE_EMAIL_DRAFT": ["GMAIL_CREATE_EMAIL_DRAFT"],
    "GMAIL_SEND_EMAIL": ["GMAIL_SEND_EMAIL"],
    "NOTION_SEARCH": ["NOTION_SEARCH_NOTION_PAGE", "NOTION_FETCH_DATA", "NOTION_SEARCH"],
    "NOTION_FETCH_DATA": ["NOTION_FETCH_DATA"],
    "NOTION_CREATE_PAGE": ["NOTION_CREATE_NOTION_PAGE", "NOTION_CREATE_PAGE"],
    "NOTION_UPDATE_PAGE": ["NOTION_UPDATE_PAGE"],
}


def _headers(api_key: str, session_id: str | None = None) -> dict[str, str]:
    headers = {
        "Content-Type": "application/json",
        "Accept": "application/json, text/event-stream",
        "x-consumer-api-key": api_key,
    }
    if session_id:
        headers["mcp-session-id"] = session_id
    return headers


def parse_mcp_http_body(text: str, content_type: str) -> dict[str, Any]:
    payload: dict[str, Any] | None = None
    if "text/event-stream" in content_type or text.lstrip().startswith(("event:", "data:")):
        for line in text.splitlines():
            if not line.startswith("data:"):
                continue
            chunk = line[5:].strip()
            if chunk and chunk != "[DONE]":
                payload = json.loads(chunk)
    else:
        payload = json.loads(text) if text else {}
    if not isinstance(payload, dict):
        raise RuntimeError("mcp_empty_response")
    return payload


def _extract_text_result(result: Any) -> Any:
    if not isinstance(result, dict):
        return result
    content = result.get("content")
    if isinstance(content, list):
        texts = [
            str(item.get("text"))
            for item in content
            if isinstance(item, dict) and item.get("text")
        ]
        if len(texts) == 1:
            raw = texts[0]
            try:
                return json.loads(raw)
            except json.JSONDecodeError:
                return raw
        if texts:
            return texts
    structured = result.get("structuredContent")
    if structured is not None:
        return structured
    return result


class ConnectMcpClient:
    def __init__(self, api_key: str) -> None:
        self._api_key = api_key
        self._session_id: str | None = None
        self._rpc_id = 0
        self._http = httpx.Client(timeout=45.0)

    def close(self) -> None:
        self._http.close()

    def _rpc(self, method: str, params: dict[str, Any] | None = None) -> Any:
        self._rpc_id += 1
        body: dict[str, Any] = {"jsonrpc": "2.0", "id": self._rpc_id, "method": method}
        if params is not None:
            body["params"] = params
        response = self._http.post(
            CONNECT_MCP_URL,
            headers=_headers(self._api_key, self._session_id),
            json=body,
        )
        session_id = response.headers.get("mcp-session-id")
        if session_id:
            self._session_id = session_id
        if response.status_code >= 400:
            raise RuntimeError(f"mcp_http_{response.status_code}")
        payload = parse_mcp_http_body(response.text, response.headers.get("content-type", ""))
        if "error" in payload and payload["error"]:
            error = payload["error"]
            message = error.get("message") if isinstance(error, dict) else str(error)
            raise RuntimeError(message or "mcp_error")
        return payload.get("result")

    def initialize(self) -> Any:
        result = self._rpc(
            "initialize",
            {
                "protocolVersion": "2024-11-05",
                "capabilities": {},
                "clientInfo": {"name": "rolloutguard", "version": "0.1.0"},
            },
        )
        self._http.post(
            CONNECT_MCP_URL,
            headers=_headers(self._api_key, self._session_id),
            json={"jsonrpc": "2.0", "method": "notifications/initialized"},
        )
        return result

    def call_tool(self, name: str, arguments: dict[str, Any]) -> Any:
        result = self._rpc("tools/call", {"name": name, "arguments": arguments})
        return _extract_text_result(result)


def map_tool_arguments(name: str, arguments: dict[str, Any]) -> dict[str, Any]:
    args = {key: value for key, value in arguments.items() if value is not None}
    args.pop("site_id", None)
    args.pop("composio_tool", None)
    if name in {"GOOGLECALENDAR_LIST_EVENTS", "GOOGLECALENDAR_EVENTS_LIST"}:
        mapped: dict[str, Any] = {
            "calendarId": args.get("calendarId") or args.get("calendar_id") or "primary",
        }
        time_min = args.get("timeMin") or args.get("time_min")
        time_max = args.get("timeMax") or args.get("time_max")
        max_results = args.get("maxResults") or args.get("max_results")
        query = args.get("q") or args.get("query")
        if time_min:
            mapped["timeMin"] = time_min
        if time_max:
            mapped["timeMax"] = time_max
        if max_results:
            mapped["maxResults"] = max_results
        if query:
            mapped["q"] = query
        return mapped
    if name == "GOOGLECALENDAR_FIND_EVENT":
        return {
            "query": args.get("query") or args.get("q") or "",
            "calendar_id": args.get("calendar_id") or args.get("calendarId") or "primary",
        }
    if name == "GOOGLECALENDAR_CREATE_EVENT":
        return {
            "summary": args.get("summary") or args.get("title") or "RolloutGuard Termin",
            "start_datetime": args.get("start_datetime") or args.get("start") or args.get("date"),
            "description": args.get("description") or "",
            "calendar_id": args.get("calendar_id") or "primary",
        }
    if name == "GMAIL_FETCH_EMAILS":
        mapped = {}
        if args.get("query"):
            mapped["query"] = args["query"]
        if args.get("max_results"):
            mapped["max_results"] = args["max_results"]
        return mapped
    if name in {"NOTION_SEARCH", "NOTION_SEARCH_NOTION_PAGE"}:
        query = args.get("query") or args.get("query_string") or args.get("search") or ""
        return {"query": query}
    return args


def _extract_multi_error(result: Any) -> str:
    if not isinstance(result, dict):
        return "tool_failed"
    data = result.get("data")
    if isinstance(data, dict):
        rows = data.get("results") or []
        if rows and isinstance(rows[0], dict):
            err = rows[0].get("error") or rows[0].get("message")
            if err:
                return str(err)
    return str(result.get("error") or "tool_failed")


def _unwrap_app_payload(result: Any) -> Any:
    if not isinstance(result, dict):
        return result
    candidates: list[dict[str, Any]] = [result]
    for key in ("data_preview", "data", "result", "response"):
        nested = result.get(key)
        if isinstance(nested, dict):
            candidates.append(nested)
    for candidate in candidates:
        if any(
            isinstance(candidate.get(key), list)
            for key in ("items", "events", "messages", "emails", "results", "pages")
        ):
            return candidate
    if isinstance(result.get("data"), dict):
        return result["data"]
    return result


def _multi_execute(client: ConnectMcpClient, slug: str, arguments: dict[str, Any]) -> Any:
    result = client.call_tool(
        "COMPOSIO_MULTI_EXECUTE_TOOL",
        {
            "tools": [{"tool_slug": slug, "arguments": arguments}],
            "sync_response_to_workbench": False,
            "memory": {},
        },
    )
    data = result.get("data") if isinstance(result, dict) else None
    failed = isinstance(result, dict) and result.get("successful") is False
    error_count = int(data.get("error_count") or 0) if isinstance(data, dict) else 0
    if failed or error_count > 0:
        raise RuntimeError(_extract_multi_error(result))
    if isinstance(data, dict) and data.get("results"):
        first = data["results"][0]
        if isinstance(first, dict):
            for key in ("response", "result", "data", "output"):
                if first.get(key) is not None:
                    return first[key]
            return first
    return result


def _toolkit_for_tool(name: str) -> str:
    if "GMAIL" in name:
        return "gmail"
    if "NOTION" in name:
        return "notion"
    return "googlecalendar"


def _is_write_tool(name: str) -> bool:
    return any(token in name for token in ("CREATE", "UPDATE", "DELETE", "SEND", "DRAFT"))


def _calendar_events(payload: dict[str, Any]) -> list[dict[str, Any]]:
    items = payload.get("items") or payload.get("events") or []
    events: list[dict[str, Any]] = []
    if not isinstance(items, list):
        return events
    for item in items[:20]:
        if not isinstance(item, dict):
            continue
        start = item.get("start") if isinstance(item.get("start"), dict) else {}
        end = item.get("end") if isinstance(item.get("end"), dict) else {}
        events.append(
            {
                "summary": item.get("summary"),
                "start": start.get("dateTime") or start.get("date") or item.get("start"),
                "end": end.get("dateTime") or end.get("date") or item.get("end"),
                "status": item.get("status"),
            }
        )
    return events


def _gmail_messages(payload: dict[str, Any]) -> list[dict[str, Any]]:
    items = payload.get("messages") or payload.get("emails") or []
    emails: list[dict[str, Any]] = []
    if not isinstance(items, list):
        return emails
    for item in items[:20]:
        if not isinstance(item, dict):
            continue
        preview = item.get("preview") if isinstance(item.get("preview"), dict) else {}
        snippet = item.get("snippet") or preview.get("body") or item.get("messageText")
        if isinstance(snippet, str):
            snippet = snippet[:240]
        emails.append(
            {
                "id": item.get("id") or item.get("messageId"),
                "subject": item.get("subject") or preview.get("subject"),
                "from": item.get("from") or item.get("sender"),
                "date": item.get("date")
                or item.get("internalDate")
                or item.get("messageTimestamp"),
                "snippet": snippet,
            }
        )
    return emails


def _notion_pages(payload: dict[str, Any]) -> list[dict[str, Any]]:
    items = payload.get("results") or payload.get("pages") or payload.get("items") or []
    pages: list[dict[str, Any]] = []
    if not isinstance(items, list):
        return pages
    for item in items[:20]:
        if not isinstance(item, dict):
            continue
        pages.append(
            {
                "id": item.get("id"),
                "title": item.get("title") or item.get("name"),
                "url": item.get("url"),
            }
        )
    return pages


def _normalize_app_result(name: str, result: Any) -> dict[str, Any]:
    if _is_write_tool(name):
        return {"connected": True, "ok": True, "result": result}
    payload = _unwrap_app_payload(result)
    if not isinstance(payload, dict):
        return {"connected": True, "result": result}
    if "CALENDAR" in name:
        return {
            "connected": True,
            "events": _calendar_events(payload),
            "timeZone": payload.get("timeZone"),
        }
    if "GMAIL" in name:
        return {"connected": True, "emails": _gmail_messages(payload)}
    if "NOTION" in name:
        return {"connected": True, "pages": _notion_pages(payload)}
    return {"connected": True, "result": payload}


def execute_connect_tool(name: str, arguments: dict[str, Any], *, api_key: str) -> Any:
    slugs = TOOL_SLUGS.get(name, [name])
    mapped = map_tool_arguments(name, arguments)
    client = ConnectMcpClient(api_key)
    last_error: Exception | None = None
    try:
        client.initialize()
        for slug in slugs:
            try:
                result = _multi_execute(client, slug, mapped)
                log.info("composio_connect_ok", tool=name, slug=slug)
                return _normalize_app_result(name, result)
            except Exception as exc:  # noqa: BLE001
                last_error = exc
                log.warning("composio_connect_slug_failed", tool=name, slug=slug)
                if "No active connection" in str(exc):
                    break
        message = str(last_error or "composio_connect_failed")
        if "No active connection" in message:
            toolkit = _toolkit_for_tool(name)
            auth = client.call_tool("COMPOSIO_MANAGE_CONNECTIONS", {"toolkits": [toolkit]})
            redirect = _redirect_url(auth)
            return {
                "connected": False,
                "needs_auth": True,
                "toolkit": toolkit,
                "redirect_url": redirect,
                "message": (
                    f"{toolkit} is not connected in Composio. "
                    "Ask the person to finish the connection"
                    + (f" at {redirect}" if redirect else "")
                    + ", then retry. Do not invent data."
                ),
            }
        if last_error:
            raise last_error
        raise RuntimeError("composio_connect_failed")
    finally:
        client.close()


def ping_connect(api_key: str) -> bool:
    client = ConnectMcpClient(api_key)
    try:
        client.initialize()
        return True
    except Exception as exc:  # noqa: BLE001
        log.warning("composio_connect_ping_failed", error=type(exc).__name__)
        return False
    finally:
        client.close()


def list_connect_toolkits(api_key: str) -> set[str]:
    client = ConnectMcpClient(api_key)
    try:
        client.initialize()
        result = client.call_tool(
            "COMPOSIO_MANAGE_CONNECTIONS",
            {"toolkits": TOOLKITS},
        )
        return _toolkits_from_manage_result(result)
    except Exception as exc:  # noqa: BLE001
        log.warning("composio_connect_list_failed", error=type(exc).__name__)
        return set()
    finally:
        client.close()


def start_connect_auth(api_key: str, toolkit: str) -> dict[str, Any]:
    client = ConnectMcpClient(api_key)
    try:
        client.initialize()
        result = client.call_tool(
            "COMPOSIO_MANAGE_CONNECTIONS",
            {"toolkits": [toolkit]},
        )
        return result if isinstance(result, dict) else {"result": result}
    finally:
        client.close()


def _redirect_url(result: Any) -> str | None:
    if isinstance(result, str) and result.startswith("http"):
        return result
    if not isinstance(result, dict):
        return None
    for key in ("redirect_url", "redirectUrl", "url"):
        value = result.get(key)
        if isinstance(value, str) and value.startswith("http"):
            return value
    for nested in (result.get("data"), result.get("results")):
        if isinstance(nested, dict):
            url = _redirect_url(nested)
            if url:
                return url
            for info in nested.values():
                url = _redirect_url(info)
                if url:
                    return url
        elif isinstance(nested, list):
            for info in nested:
                url = _redirect_url(info)
                if url:
                    return url
    return None


def _has_active_account(info: Any) -> bool:
    accounts = info.get("accounts") if isinstance(info, dict) else []
    if not isinstance(accounts, list):
        return False
    return any(
        isinstance(account, dict) and str(account.get("status") or "").lower() == "active"
        for account in accounts
    )


def _toolkits_from_manage_result(result: Any) -> set[str]:
    found: set[str] = set()
    data = result.get("data") if isinstance(result, dict) else result
    rows = data.get("results") if isinstance(data, dict) else None
    if isinstance(rows, dict):
        for slug, info in rows.items():
            if _has_active_account(info):
                found.add(str(slug).lower())
    elif isinstance(rows, list):
        for info in rows:
            if not isinstance(info, dict):
                continue
            slug = info.get("toolkit") or info.get("slug") or info.get("name")
            if slug and _has_active_account(info):
                found.add(str(slug).lower())
    return found
