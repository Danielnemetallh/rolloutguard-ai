"""LLM provider abstraction — DeepSeek + deterministic mock."""

from __future__ import annotations

import json
import re
from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Any

import httpx

from rolloutguard_api.core.config import get_settings
from rolloutguard_api.core.logging import get_logger

log = get_logger(__name__)


@dataclass
class LLMResponse:
    content: str
    model: str
    latency_ms: int
    raw: dict[str, Any] | None = None
    tool_calls: list[dict[str, Any]] | None = None
    reasoning_content: str | None = None


class LLMProvider(ABC):
    name: str

    @abstractmethod
    def complete(
        self,
        messages: list[dict[str, Any]],
        *,
        tools: list[dict[str, Any]] | None = None,
        temperature: float = 0.0,
        max_tokens: int = 1200,
        thinking: bool = False,
    ) -> LLMResponse:
        raise NotImplementedError

    def complete_json(
        self,
        messages: list[dict[str, Any]],
        *,
        temperature: float = 0.0,
    ) -> dict[str, Any]:
        response = self.complete(messages, temperature=temperature)
        return extract_json_object(response.content)


def _last_tool_name(messages: list[dict[str, Any]]) -> str | None:
    for msg in reversed(messages):
        if msg.get("role") == "assistant" and msg.get("tool_calls"):
            call = msg["tool_calls"][0]
            return str(call.get("function", {}).get("name") or "")
        if msg.get("role") == "tool":
            continue
    return None


def _last_tool_result(messages: list[dict[str, Any]]) -> dict[str, Any]:
    for msg in reversed(messages):
        if msg.get("role") != "tool":
            continue
        content = msg.get("content")
        if not isinstance(content, str):
            continue
        try:
            payload = json.loads(content)
        except json.JSONDecodeError:
            return {}
        return payload if isinstance(payload, dict) else {}
    return {}


class MockLLMProvider(LLMProvider):
    """Deterministic fixture provider for demos and CI."""

    name = "deterministic-mock"

    def complete(
        self,
        messages: list[dict[str, Any]],
        *,
        tools: list[dict[str, Any]] | None = None,
        temperature: float = 0.0,
        max_tokens: int = 1200,
        thinking: bool = False,
    ) -> LLMResponse:
        user = next((m["content"] for m in reversed(messages) if m.get("role") == "user"), "")
        text = user if isinstance(user, str) else json.dumps(user)

        if tools:
            lowered = text.lower()
            last = _last_tool_name(messages)
            tool_names = {
                spec.get("function", {}).get("name")
                for spec in tools
                if isinstance(spec, dict)
            }

            def _call(name: str, arguments: dict[str, Any], call_id: str) -> LLMResponse:
                return LLMResponse(
                    content="",
                    model=self.name,
                    latency_ms=1,
                    tool_calls=[
                        {
                            "id": call_id,
                            "type": "function",
                            "function": {
                                "name": name,
                                "arguments": json.dumps(arguments),
                            },
                        }
                    ],
                )

            wants_draft = any(
                k in lowered
                for k in (
                    "mail",
                    "e-mail",
                    "briefing",
                    "digest",
                    "watch",
                    "überwach",
                    "aufgabe",
                    "karte",
                    "notion",
                    "override",
                    "überschreib",
                )
            )
            wants_corpus = any(
                k in lowered
                for k in ("vertrag", "pdf", "dokument", "hochgeladen", "sow")
            )
            wants_diff = "neu seit" in lowered or "letzter lauf" in lowered

            if last == "get_portfolio_kpis":
                tool_result = _last_tool_result(messages)
                kpis = tool_result.get("kpis") if isinstance(tool_result.get("kpis"), dict) else {}
                total_sites = kpis.get("sites_total") or kpis.get("total_sites") or "unbekannt"
                return LLMResponse(
                    content=json.dumps(
                        {
                            "answer": (
                                f"Das Portfolio umfasst {total_sites} Standorte "
                                f"(Lauf #{tool_result.get('analysis_run_id', '?')}). "
                                f"Kritische Befunde: {kpis.get('findings_critical', '?')}."
                            ),
                            "site_ids": [],
                            "evidence_ids": [],
                            "memory_ids": [],
                            "proposed_action_ids": [],
                            "tool_trace": ["get_portfolio_kpis"],
                            "abstained": False,
                            "confidence": 0.82,
                        }
                    ),
                    model=self.name,
                    latency_ms=1,
                )
            if last == "list_findings":
                tool_result = _last_tool_result(messages)
                raw_findings = tool_result.get("findings")
                findings = raw_findings if isinstance(raw_findings, list) else []
                lines = [
                    f"- {item.get('site_id')} ({item.get('rule_id')}, {item.get('severity')}): "
                    f"{item.get('message')}"
                    for item in findings[:3]
                    if isinstance(item, dict)
                ]
                return LLMResponse(
                    content=json.dumps(
                        {
                            "answer": (
                                "Kritische Standorte, die das nahe Integrationsziel gefährden:\n"
                                + (
                                    "\n".join(lines)
                                    if lines
                                    else "- Keine kritischen Befunde gelistet."
                                )
                            ),
                            "site_ids": [
                                str(item.get("site_id"))
                                for item in findings[:3]
                                if isinstance(item, dict) and item.get("site_id")
                            ],
                            "evidence_ids": [
                                eid
                                for item in findings[:3]
                                if isinstance(item, dict)
                                for eid in item.get("evidence_ids") or []
                                if eid
                            ][:12],
                            "memory_ids": [],
                            "proposed_action_ids": [],
                            "tool_trace": ["list_findings"],
                            "abstained": False,
                            "confidence": 0.78,
                        }
                    ),
                    model=self.name,
                    latency_ms=1,
                )
            if last == "get_site_timeline":
                tool_result = _last_tool_result(messages)
                site_id = str(tool_result.get("site_id") or "DE-NRW-0107")
                raw_events = tool_result.get("events")
                events = raw_events if isinstance(raw_events, list) else []
                preview = (
                    f"Erstes Ereignis: {events[0].get('label')}"
                    if events and isinstance(events[0], dict)
                    else "Keine Timeline-Ereignisse gefunden."
                )
                return LLMResponse(
                    content=json.dumps(
                        {
                            "answer": f"Timeline für {site_id}: {preview}",
                            "site_ids": [site_id],
                            "evidence_ids": [],
                            "memory_ids": [],
                            "proposed_action_ids": [],
                            "tool_trace": ["get_site_timeline"],
                            "abstained": False,
                            "confidence": 0.8,
                        }
                    ),
                    model=self.name,
                    latency_ms=1,
                )
            if last == "search_corpus":
                return LLMResponse(
                    content=json.dumps(
                        {
                            "answer": (
                                "Im synthetischen Vertrag zu DE-NRW-0107 steht die "
                                "vertragliche Fälligkeit 15.09.2026 (doc:sow#c0)."
                            ),
                            "site_ids": ["DE-NRW-0107"],
                            "evidence_ids": [],
                            "memory_ids": ["doc:sow#c0"],
                            "proposed_action_ids": [],
                            "tool_trace": ["search_corpus"],
                            "abstained": False,
                            "confidence": 0.8,
                        }
                    ),
                    model=self.name,
                    latency_ms=1,
                )
            if last == "GMAIL_CREATE_EMAIL_DRAFT":
                return LLMResponse(
                    content=json.dumps(
                        {
                            "answer": (
                                "E-Mail wartet auf Freigabe in der Seitenleiste. "
                                "Erst nach Freigeben wird Gmail über Composio aufgerufen."
                            ),
                            "site_ids": ["DE-NRW-0107"],
                            "evidence_ids": [],
                            "memory_ids": [],
                            "proposed_action_ids": [],
                            "tool_trace": ["GMAIL_CREATE_EMAIL_DRAFT"],
                            "abstained": False,
                            "confidence": 0.85,
                        }
                    ),
                    model=self.name,
                    latency_ms=1,
                )
            if last == "GOOGLECALENDAR_LIST_EVENTS":
                return LLMResponse(
                    content=json.dumps(
                        {
                            "answer": (
                                "Kalender gelesen. Wenn Composio nicht verbunden ist, "
                                "nutze ich die sichtbaren Befundtermine."
                            ),
                            "site_ids": [],
                            "evidence_ids": [],
                            "memory_ids": [],
                            "proposed_action_ids": [],
                            "tool_trace": ["GOOGLECALENDAR_LIST_EVENTS"],
                            "abstained": False,
                            "confidence": 0.8,
                        }
                    ),
                    model=self.name,
                    latency_ms=1,
                )
            if wants_corpus and last != "search_corpus" and "search_corpus" in tool_names:
                return _call(
                    "search_corpus",
                    {"query": "DE-NRW-0107 Vertrag"},
                    "call_mock_corpus",
                )
            if wants_diff and last != "search_corpus" and "search_corpus" in tool_names:
                return _call("search_corpus", {"query": "neu SLA"}, "call_mock_diff")
            wants_calendar = any(
                k in lowered for k in ("kalender", "termin", "calendar", "im kalender")
            )
            if wants_calendar and "GOOGLECALENDAR_LIST_EVENTS" in tool_names:
                return _call("GOOGLECALENDAR_LIST_EVENTS", {}, "call_mock_calendar_list")
            if wants_draft and "GMAIL_CREATE_EMAIL_DRAFT" in tool_names:
                return _call(
                    "GMAIL_CREATE_EMAIL_DRAFT",
                    {
                        "site_id": "DE-NRW-0107",
                        "recipient_email": "partner@nordturm.demo",
                        "subject": "SLA-Risiko DE-NRW-0107",
                        "body": "Kritischer SLA-Befund — Freigeben für Gmail-Entwurf.",
                    },
                    "call_mock_draft_email",
                )
            if "timeline" in lowered or "DE-NRW-0107" in text:
                site_match = re.search(r"DE-[A-Z]+-\d+", text)
                site_id = site_match.group(0) if site_match else "DE-NRW-0107"
                return _call(
                    "get_site_timeline",
                    {"site_id": site_id},
                    "call_mock_timeline",
                )
            if (
                "threaten" in lowered
                or "september" in lowered
                or "gefährden" in lowered
                or "gefaehrden" in lowered
                or ("kritisch" in lowered and "befund" in lowered)
            ):
                return _call(
                    "list_findings",
                    {"severity": "critical", "limit": 3},
                    "call_mock_findings",
                )
            return _call("get_portfolio_kpis", {}, "call_mock_kpis")

        if (
            "explain this deterministic finding" in text.lower()
            or "erkläre diesen deterministischen befund" in text.lower()
            or '"rule_id"' in text
        ):
            evidence_ids = re.findall(r"E-[A-Z]+-\d+", text)
            payload: dict[str, Any] = {
                "summary": (
                    "Die Integration ist nach der vertraglichen Fälligkeit geplant; "
                    "Fibre-Ready und Neuplanung prüfen."
                ),
                "evidence_ids": evidence_ids[:4] or ["E-CONTRACT-1", "E-SCHEDULE-1"],
                "blocker_category": "BACKHAUL_READINESS",
                "proposed_next_action": (
                    "Prüfen, ob das Fibre-Ready-Datum vorgezogen werden kann "
                    "oder der Integrationsslot neu geplant werden muss."
                ),
                "confidence": 0.9,
                "abstained": False,
            }
            if "insufficient" in text.lower() or "abstain" in text.lower():
                payload = {
                    "summary": "Unzureichende Evidenz, um diesen Befund zu erklären.",
                    "evidence_ids": [],
                    "blocker_category": None,
                    "proposed_next_action": None,
                    "confidence": 0.2,
                    "abstained": True,
                }
            return LLMResponse(
                content=json.dumps(payload),
                model=self.name,
                latency_ms=1,
            )

        if (
            "blocker" in text.lower()
            or "classify" in text.lower()
            or "klassifiziere" in text.lower()
        ):
            payload = {
                "blocker_category": "BACKHAUL_READINESS",
                "confidence": 0.92,
                "abstained": False,
            }
        elif "map" in text.lower() or "header" in text.lower() or "spalte" in text.lower():
            payload = {
                "canonical_field": "forecast_date",
                "confidence": 0.88,
                "abstained": False,
                "rationale": "Spalte bezeichnet ein Forecast-Meilensteindatum",
            }
        else:
            payload = {
                "summary": "Kein spezieller Mock-Pfad getroffen; Enthaltung.",
                "evidence_ids": [],
                "blocker_category": None,
                "proposed_next_action": None,
                "confidence": 0.1,
                "abstained": True,
            }

        return LLMResponse(
            content=json.dumps(payload),
            model=self.name,
            latency_ms=1,
        )


class DeepSeekProvider(LLMProvider):
    name = "deepseek"

    def __init__(
        self,
        *,
        api_key: str,
        base_url: str,
        model: str,
        reasoning_effort: str = "low",
        timeout_s: float = 90.0,
    ) -> None:
        self.api_key = api_key
        self.base_url = base_url.rstrip("/")
        self.model = model
        self.reasoning_effort = reasoning_effort.strip().lower()
        self.timeout_s = timeout_s

    def _reasoning_effort(self, *, thinking: bool | None) -> str | None:
        effort = self.reasoning_effort
        use_thinking = thinking if thinking is not None else effort != "disabled"
        if not use_thinking or effort == "disabled":
            return None
        return effort if effort in {"low", "high", "max"} else "low"

    def complete(
        self,
        messages: list[dict[str, Any]],
        *,
        tools: list[dict[str, Any]] | None = None,
        temperature: float = 0.0,
        max_tokens: int = 1600,
        thinking: bool | None = None,
    ) -> LLMResponse:
        import time

        reasoning_effort = self._reasoning_effort(thinking=thinking)
        payload: dict[str, Any] = {
            "model": self.model,
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_tokens,
            "thinking": {"type": "enabled" if reasoning_effort else "disabled"},
        }
        if reasoning_effort:
            payload["reasoning_effort"] = reasoning_effort
        if tools:
            payload["tools"] = tools
            payload["tool_choice"] = "auto"
        else:
            payload["response_format"] = {"type": "json_object"}

        started = time.perf_counter()
        with httpx.Client(timeout=self.timeout_s) as client:
            try:
                response = client.post(
                    f"{self.base_url}/chat/completions",
                    headers={
                        "Authorization": f"Bearer {self.api_key}",
                        "Content-Type": "application/json",
                    },
                    json=payload,
                )
                response.raise_for_status()
            except httpx.HTTPStatusError as exc:
                if (
                    not tools
                    and "response_format" in payload
                    and exc.response is not None
                    and exc.response.status_code in {400, 422}
                ):
                    payload.pop("response_format", None)
                    response = client.post(
                        f"{self.base_url}/chat/completions",
                        headers={
                            "Authorization": f"Bearer {self.api_key}",
                            "Content-Type": "application/json",
                        },
                        json=payload,
                    )
                    response.raise_for_status()
                else:
                    raise
            data = response.json()
        latency_ms = int((time.perf_counter() - started) * 1000)

        choice = data["choices"][0]["message"]
        tool_calls = choice.get("tool_calls")
        content = choice.get("content") or ""
        reasoning = choice.get("reasoning_content") or choice.get("reasoning")
        return LLMResponse(
            content=content,
            model=data.get("model", self.model),
            latency_ms=latency_ms,
            raw=data,
            tool_calls=tool_calls,
            reasoning_content=reasoning if isinstance(reasoning, str) else None,
        )


def extract_json_object(text: str) -> dict[str, Any]:
    text = text.strip()
    if not text:
        raise ValueError("Empty model response")

    fenced = re.search(r"```(?:json)?\s*([\s\S]*?)```", text, re.IGNORECASE)
    if fenced:
        text = fenced.group(1).strip()

    try:
        value = json.loads(text)
        if isinstance(value, dict):
            return value
    except json.JSONDecodeError:
        pass
    match = re.search(r"\{[\s\S]*\}", text)
    if not match:
        raise ValueError("No JSON object in model response")
    value = json.loads(match.group(0))
    if not isinstance(value, dict):
        raise ValueError("JSON payload is not an object")
    return value


def llm_mock_reason(*, force_mock: bool = False) -> str | None:
    """Return why the deterministic mock is active, or None when live LLM is configured."""
    settings = get_settings()
    if force_mock:
        return "force_mock"
    if not settings.has_deepseek_api_key:
        return "no_api_key"
    if not settings.llm_enabled:
        return "llm_disabled"
    return None


def get_llm_provider(*, force_mock: bool = False) -> LLMProvider:
    settings = get_settings()
    reason = llm_mock_reason(force_mock=force_mock)
    if reason:
        log.info("llm_using_mock", reason=reason)
        return MockLLMProvider()
    return DeepSeekProvider(
        api_key=settings.deepseek_api_key,
        base_url=settings.deepseek_base_url,
        model=settings.deepseek_model,
        reasoning_effort=settings.deepseek_reasoning_effort,
    )
