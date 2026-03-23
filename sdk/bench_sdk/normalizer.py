"""Response → Bench events conversion."""
from __future__ import annotations

from typing import Any, Callable

# Field names that map to message events
MESSAGE_FIELDS: set[str] = {"reply", "text", "content", "message", "answer", "response"}

# Field names that map to function_call events
TOOL_FIELDS: set[str] = {"tool_calls", "actions", "function_calls", "tools", "tool_invocations"}

# Field names that map to agent_handoff events
HANDOFF_FIELDS: set[str] = {"handoff", "agent_handoff", "transfer_to", "transfer"}


def _to_dict(response: Any) -> Any:
    """Unwrap Pydantic models to plain dicts."""
    try:
        return response.model_dump()
    except AttributeError:
        pass
    try:
        return response.dict()  # Pydantic v1
    except AttributeError:
        pass
    return response


def _normalize_tool_calls(raw: Any) -> list[dict[str, Any]]:
    """Convert a list of tool call objects/dicts to Bench function_call events."""
    if not isinstance(raw, list):
        raw = [raw]
    events: list[dict[str, Any]] = []
    for item in raw:
        if isinstance(item, dict):
            name = item.get("name") or item.get("tool") or item.get("id") or ""
            arguments = item.get("arguments") or item.get("params") or item.get("input") or {}
        else:
            item_d = _to_dict(item)
            if isinstance(item_d, dict):
                name = item_d.get("name") or item_d.get("tool") or item_d.get("id") or ""
                arguments = item_d.get("arguments") or item_d.get("params") or item_d.get("input") or {}
            else:
                name = str(item_d)
                arguments = {}
        events.append({"type": "function_call", "name": str(name), "arguments": arguments})
    return events


def _normalize_handoff(raw: Any) -> dict[str, Any]:
    """Convert a handoff value to a Bench agent_handoff event."""
    if isinstance(raw, str):
        return {"type": "agent_handoff", "new_agent_type": raw}
    if isinstance(raw, dict):
        return {"type": "agent_handoff", "new_agent_type": str(raw.get("agent_type", ""))}
    return {"type": "agent_handoff", "new_agent_type": str(raw)}


def normalize_response(
    response: Any,
    output_map: dict[str, str] | Callable[[Any], list[dict[str, Any]]] | None = None,
) -> list[dict[str, Any]]:
    """Convert a handler response to a list of Bench events.

    Parameters
    ----------
    response:
        Raw return value from the handler function.
    output_map:
        - ``callable``: called with response, should return list of event dicts.
        - ``dict``: ``{ "enterprise_field": "event_type" }`` where event_type is
          one of ``"message"``, ``"function_calls"``, ``"agent_handoff"``.
        - ``None``: auto-infer from response shape.

    Returns
    -------
    list[dict]
        Bench event list.
    """
    # ── callable output_map ───────────────────────────────────────────────
    if callable(output_map):
        result = output_map(response)
        if isinstance(result, list):
            return result
        return [result]

    # ── unwrap Pydantic ───────────────────────────────────────────────────
    response = _to_dict(response)

    # ── dict output_map ───────────────────────────────────────────────────
    if isinstance(output_map, dict) and output_map:
        events: list[dict[str, Any]] = []
        for field, event_type in output_map.items():
            if not isinstance(response, dict):
                break
            value = response.get(field)
            if value is None:
                continue
            if event_type == "message":
                events.append({"type": "message", "role": "assistant", "content": str(value)})
            elif event_type == "function_calls":
                events.extend(_normalize_tool_calls(value))
            elif event_type == "agent_handoff":
                events.append(_normalize_handoff(value))
        return events

    # ── auto-infer ────────────────────────────────────────────────────────
    # Already a list of events
    if isinstance(response, dict) and "events" in response:
        return response["events"]  # type: ignore[return-value]

    # Plain string
    if isinstance(response, str):
        return [{"type": "message", "role": "assistant", "content": response}]

    if isinstance(response, dict):
        # message fields
        for field in MESSAGE_FIELDS:
            if field in response:
                return [{"type": "message", "role": "assistant", "content": str(response[field])}]

        # tool fields
        for field in TOOL_FIELDS:
            if field in response:
                return _normalize_tool_calls(response[field])

        # handoff fields
        for field in HANDOFF_FIELDS:
            if field in response:
                return [_normalize_handoff(response[field])]

    # Fallback: stringify entire response
    return [{"type": "message", "role": "assistant", "content": str(response)}]
