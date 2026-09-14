"""Intercept Composio tool calls: auto-run reads, pause writes for Freigeben."""

from __future__ import annotations

from typing import Any, Literal

from sqlalchemy.orm import Session

from rolloutguard_api.ai.tools import tool_fn
from rolloutguard_api.core.logging import get_logger
from rolloutguard_api.integrations.composio_executor import execute_composio_tool
from rolloutguard_api.services.actions import upsert_draft

log = get_logger(__name__)

Policy = Literal["auto", "ask", "block"]

# Real Composio tool names. Unknown names are blocked.
TOOL_POLICY: dict[str, Policy] = {
    "GOOGLECALENDAR_LIST_EVENTS": "auto",
    "GOOGLECALENDAR_EVENTS_LIST": "auto",
    "GOOGLECALENDAR_FIND_EVENT": "auto",
    "GOOGLECALENDAR_GET_CURRENT_DATE_TIME": "auto",
    "GMAIL_FETCH_EMAILS": "auto",
    "GMAIL_GET_PROFILE": "auto",
    "NOTION_SEARCH": "auto",
    "NOTION_FETCH_DATA": "auto",
    "GOOGLECALENDAR_CREATE_EVENT": "ask",
    "GOOGLECALENDAR_UPDATE_EVENT": "ask",
    "GOOGLECALENDAR_DELETE_EVENT": "ask",
    "GMAIL_CREATE_EMAIL_DRAFT": "ask",
    "NOTION_CREATE_PAGE": "auto",
    "NOTION_UPDATE_PAGE": "auto",
}

TOOL_ACTION_TYPE: dict[str, str] = {
    "GOOGLECALENDAR_CREATE_EVENT": "calendar",
    "GOOGLECALENDAR_UPDATE_EVENT": "calendar",
    "GOOGLECALENDAR_DELETE_EVENT": "calendar",
    "GMAIL_CREATE_EMAIL_DRAFT": "email",
    "NOTION_CREATE_PAGE": "board",
    "NOTION_UPDATE_PAGE": "board",
}


COMPOSIO_TOOL_SPECS: list[dict[str, Any]] = [
    tool_fn(
        "GOOGLECALENDAR_LIST_EVENTS",
        "Google-Kalendertermine lesen (kein Schreiben). Hook führt den Aufruf sofort aus.",
        {
            "time_min": {"type": "string"},
            "time_max": {"type": "string"},
            "query": {"type": "string"},
            "max_results": {"type": "integer"},
        },
        [],
    ),
    tool_fn(
        "GOOGLECALENDAR_FIND_EVENT",
        "Einen Kalendertermin per Stichwort suchen. Sofort, ohne Freigabe.",
        {"query": {"type": "string"}},
        ["query"],
    ),
    tool_fn(
        "GMAIL_FETCH_EMAILS",
        "Gmail-Nachrichten lesen (kein Senden). Hook führt den Aufruf sofort aus.",
        {
            "query": {"type": "string"},
            "max_results": {"type": "integer"},
        },
        [],
    ),
    tool_fn(
        "NOTION_SEARCH",
        "Notion-Seiten suchen. Sofort, ohne Freigabe.",
        {"query": {"type": "string"}},
        ["query"],
    ),
    tool_fn(
        "GOOGLECALENDAR_CREATE_EVENT",
        "Google-Kalendertermin anlegen. Der Hook fragt zuerst um Freigabe.",
        {
            "summary": {"type": "string"},
            "start_datetime": {"type": "string"},
            "description": {"type": "string"},
            "site_id": {"type": "string"},
        },
        ["summary", "start_datetime"],
    ),
    tool_fn(
        "GMAIL_CREATE_EMAIL_DRAFT",
        "Gmail-Entwurf anlegen. Der Hook fragt zuerst um Freigabe.",
        {
            "recipient_email": {"type": "string"},
            "subject": {"type": "string"},
            "body": {"type": "string"},
            "site_id": {"type": "string"},
        },
        ["subject", "body"],
    ),
    tool_fn(
        "NOTION_CREATE_PAGE",
        "Notiz auf der zugeordneten Demo-Notion-Seite anlegen. Läuft sofort, ohne Freigabe.",
        {
            "title": {"type": "string"},
            "content": {"type": "string"},
            "site_id": {"type": "string"},
        },
        ["title"],
    ),
    tool_fn(
        "NOTION_UPDATE_PAGE",
        "Inhalt auf der zugeordneten Demo-Notion-Seite ergänzen. Läuft sofort, ohne Freigabe.",
        {
            "title": {"type": "string"},
            "content": {"type": "string"},
            "site_id": {"type": "string"},
        },
        ["content"],
    ),
]

COMPOSIO_TOOL_NAMES = {spec["function"]["name"] for spec in COMPOSIO_TOOL_SPECS} | set(
    TOOL_POLICY
)


def policy_for(name: str) -> Policy:
    return TOOL_POLICY.get(name, "block")


def run_composio_hook(
    db: Session,
    *,
    name: str,
    arguments: dict[str, Any],
    analysis_run_id: int,
) -> dict[str, Any]:
    """Always-on interceptor for Composio tools."""
    policy = policy_for(name)
    log.info("composio_hook", tool=name, policy=policy)
    if policy == "block":
        return {
            "error": "tool_blocked",
            "name": name,
            "message": "Dieses Composio-Tool ist nicht freigegeben.",
        }
    if policy == "auto":
        return execute_composio_tool(name, arguments)

    action_type = TOOL_ACTION_TYPE.get(name, "task")
    site_id = arguments.get("site_id")
    payload = {
        **arguments,
        "composio_tool": name,
        "title": arguments.get("summary") or arguments.get("subject") or arguments.get("title"),
    }
    row = upsert_draft(
        db,
        action_type=action_type,
        payload=payload,
        analysis_run_id=analysis_run_id,
        site_ids=[str(site_id)] if site_id else [],
    )
    return {
        "status": "pending_permission",
        "proposed_action_id": row.id,
        "composio_tool": name,
        "action_type": action_type,
        "message": (
            "Wartet auf Freigabe in der Seitenleiste. "
            "Der Composio-Aufruf läuft erst nach Freigeben."
        ),
    }
