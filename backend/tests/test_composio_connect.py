"""Composio Connect MCP helper tests (no live network)."""

from __future__ import annotations

from rolloutguard_api.integrations.composio_connect import (
    _extract_multi_error,
    _normalize_app_result,
    _toolkits_from_manage_result,
    map_tool_arguments,
    parse_mcp_http_body,
)
from rolloutguard_api.integrations.composio_executor import execute_composio_tool


def test_parse_mcp_sse_body() -> None:
    body = (
        "event: message\n"
        'data: {"jsonrpc":"2.0","id":1,"result":{"ok":true}}\n\n'
    )
    payload = parse_mcp_http_body(body, "text/event-stream")
    assert payload["result"]["ok"] is True


def test_map_calendar_list_arguments() -> None:
    mapped = map_tool_arguments(
        "GOOGLECALENDAR_LIST_EVENTS",
        {"time_min": "2026-01-01", "max_results": 10, "site_id": "DE-NRW-0107"},
    )
    assert mapped["calendarId"] == "primary"
    assert mapped["timeMin"] == "2026-01-01"
    assert mapped["maxResults"] == 10
    assert "site_id" not in mapped


def test_connect_key_does_not_use_backend_sdk(monkeypatch) -> None:
    from rolloutguard_api.core.config import get_settings
    from rolloutguard_api.integrations import composio_connect, composio_executor

    get_settings.cache_clear()
    composio_executor._session_cache.clear()
    monkeypatch.setenv("COMPOSIO_API_KEY", "ck_testkey")
    get_settings.cache_clear()

    def boom(*_args, **_kwargs):
        raise AssertionError("SDK backend path must not run for ck_ keys")

    monkeypatch.setattr(composio_executor, "_composio_client", boom)
    monkeypatch.setattr(
        composio_connect,
        "execute_connect_tool",
        lambda name, arguments, api_key: {"events": [{"summary": "Stand-up"}]},
    )
    result = execute_composio_tool("GOOGLECALENDAR_LIST_EVENTS", {})
    assert result["connected"] is True
    assert result["events"][0]["summary"] == "Stand-up"
    get_settings.cache_clear()
    composio_executor._session_cache.clear()


def test_active_toolkits_require_active_account() -> None:
    found = _toolkits_from_manage_result(
        {
            "successful": True,
            "data": {
                "results": {
                    "gmail": {"accounts": [{"status": "active"}]},
                    "googlecalendar": {"accounts": [{"status": "active"}]},
                    "notion": {"accounts": [{"status": "initiated"}]},
                }
            },
        }
    )
    assert found == {"gmail", "googlecalendar"}


def test_gmail_preview_payload_normalizes_messages() -> None:
    result = _normalize_app_result(
        "GMAIL_FETCH_EMAILS",
        {
            "successful": True,
            "data_preview": {
                "messages": [
                    {
                        "messageId": "abc",
                        "sender": "ops@example.com",
                        "preview": {"subject": "Stand-up notes"},
                    }
                ]
            },
        },
    )
    assert result["connected"] is True
    assert result["emails"][0]["subject"] == "Stand-up notes"


def test_multi_error_uses_inner_connection_message() -> None:
    message = _extract_multi_error(
        {
            "successful": False,
            "error": "1 out of 1 tools failed",
            "data": {
                "error_count": 1,
                "results": [
                    {"error": "No active connection found for toolkit(s) 'notion' in this session."}
                ],
            },
        }
    )
    assert "No active connection" in message
