"""Cooperative cancellation for in-flight assistant queries."""

from __future__ import annotations

import threading
from collections.abc import Iterator
from contextlib import contextmanager
from contextvars import ContextVar, Token

import httpx


class AgentCancelled(Exception):
    """The client disconnected or Anhalten was requested."""


_cancel_event: ContextVar[threading.Event | None] = ContextVar(
    "agent_cancel_event", default=None
)

_lock = threading.Lock()
_by_request: dict[str, threading.Event] = {}
_by_run: dict[int, set[str]] = {}


def current_cancel_event() -> threading.Event | None:
    return _cancel_event.get()


def is_cancelled() -> bool:
    event = _cancel_event.get()
    return event is not None and event.is_set()


def raise_if_cancelled() -> None:
    if is_cancelled():
        raise AgentCancelled()


@contextmanager
def using_cancel_event(event: threading.Event | None) -> Iterator[threading.Event | None]:
    token: Token[threading.Event | None] = _cancel_event.set(event)
    try:
        yield event
    finally:
        _cancel_event.reset(token)


def register_inflight(
    event: threading.Event,
    *,
    analysis_run_id: int,
    client_request_id: str | None,
) -> str:
    key = (client_request_id or "").strip() or f"run:{analysis_run_id}:{id(event)}"
    with _lock:
        _by_request[key] = event
        _by_run.setdefault(analysis_run_id, set()).add(key)
    return key


def unregister_inflight(key: str, analysis_run_id: int) -> None:
    with _lock:
        _by_request.pop(key, None)
        remaining = _by_run.get(analysis_run_id)
        if remaining is None:
            return
        remaining.discard(key)
        if not remaining:
            _by_run.pop(analysis_run_id, None)


def cancel_inflight(
    *,
    client_request_id: str | None = None,
    analysis_run_id: int | None = None,
) -> int:
    """Set cancel events for a request and/or every query of a run."""
    keys: set[str] = set()
    with _lock:
        request_id = (client_request_id or "").strip()
        if request_id:
            if request_id in _by_request:
                keys.add(request_id)
        if analysis_run_id is not None:
            keys.update(_by_run.get(analysis_run_id, set()))
        events = [_by_request[key] for key in keys if key in _by_request]
    for event in events:
        event.set()
    return len(events)


def watch_client_close(client: httpx.Client) -> threading.Event:
    """Close an httpx client from another thread when this query is cancelled."""
    done = threading.Event()
    cancel = current_cancel_event()

    def _watch() -> None:
        while not done.is_set():
            if cancel is not None and cancel.is_set():
                try:
                    client.close()
                except Exception:  # noqa: BLE001
                    pass
                return
            done.wait(0.05)

    threading.Thread(target=_watch, daemon=True, name="rg-http-abort").start()
    return done
