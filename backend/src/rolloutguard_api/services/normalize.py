"""Normalization helpers for IDs, dates, and partner status vocabularies."""

from __future__ import annotations

import re
from datetime import date, datetime
from typing import Any

from rolloutguard_api.domain.schema import STATUS_VOCAB

# Reverse map: partner label (lower) → canonical status key
_STATUS_REVERSE: dict[str, str] = {}


def _build_status_reverse() -> None:
    if _STATUS_REVERSE:
        return
    for labels in STATUS_VOCAB.values():
        for key, label in labels.items():
            _STATUS_REVERSE[label.strip().lower()] = key
    # Extra English/German aliases
    extras = {
        "on track": "ON_TRACK",
        "at risk": "AT_RISK",
        "delayed": "DELAYED",
        "completed": "DONE",
        "done": "DONE",
        "fertig": "DONE",
        "grün": "ON_TRACK",
        "gruen": "ON_TRACK",
        "gelb": "AT_RISK",
        "rot": "DELAYED",
        "ok": "ON_TRACK",
        "watch": "AT_RISK",
        "late": "DELAYED",
        "pending": "ON_TRACK",
        "approved": "DONE",
        "complete": "DONE",
        "not_started": "ON_TRACK",
        "not started": "ON_TRACK",
    }
    _STATUS_REVERSE.update(extras)


def normalize_site_id(value: Any) -> str | None:
    if value is None:
        return None
    text = str(value).strip()
    if not text or text.lower() == "none":
        return None
    # Excel may coerce leading zeros — keep as string always
    if re.fullmatch(r"\d+\.0", text):
        text = text[:-2]
    return text


def parse_date(value: Any) -> tuple[date | None, str | None]:
    """Return (date, error_code). error_code is DQ-003 reason when unparseable."""
    if value is None or (isinstance(value, str) and value.strip() == ""):
        return None, None
    if isinstance(value, datetime):
        return value.date(), None
    if isinstance(value, date):
        return value, None

    text = str(value).strip()
    # ISO
    if re.fullmatch(r"\d{4}-\d{2}-\d{2}", text):
        try:
            return date.fromisoformat(text), None
        except ValueError:
            return None, "unparseable_iso"
    # German dd.mm.yyyy
    if re.fullmatch(r"\d{1,2}\.\d{1,2}\.\d{4}", text):
        day, month, year = text.split(".")
        try:
            return date(int(year), int(month), int(day)), None
        except ValueError:
            return None, "unparseable_german"
    # Ambiguous free text
    return None, "ambiguous_or_unknown"


def normalize_status(value: Any) -> tuple[str | None, bool]:
    """Return (canonical_status_or_raw, is_known)."""
    _build_status_reverse()
    if value is None or str(value).strip() == "":
        return None, True
    raw = str(value).strip()
    key = _STATUS_REVERSE.get(raw.lower())
    if key:
        return key, True
    # Already canonical?
    upper = raw.upper().replace(" ", "_")
    canonical = {
        "ON_TRACK",
        "AT_RISK",
        "DELAYED",
        "DONE",
        "PENDING",
        "APPROVED",
        "COMPLETE",
        "NOT_STARTED",
    }
    if upper in canonical:
        return upper, True
    return raw, False


def coerce_int(value: Any) -> int | None:
    if value is None or str(value).strip() == "":
        return None
    try:
        return int(float(str(value).strip()))
    except ValueError:
        return None
