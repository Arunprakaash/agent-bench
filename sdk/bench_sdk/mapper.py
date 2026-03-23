"""Input mapping — builds the request_template registered with Bench."""
from __future__ import annotations

import inspect
from typing import Any, Callable

BENCH_FIELDS: set[str] = {
    "user_input",
    "chat_history",
    "llm_model",
    "judge_model",
    "scenario_id",
    "agent_args",
}

# Known name patterns → bench field
_NAME_PATTERNS: dict[str, set[str]] = {
    "user_input": {"query", "message", "input", "text", "prompt", "user_input", "user_message", "msg"},
    "chat_history": {"messages", "history", "context", "chat_history", "conversation"},
    "llm_model": {"model", "llm_model", "llm"},
    "scenario_id": {"session_id", "scenario_id", "session", "request_id"},
}

# Reverse lookup: alias → bench field
_ALIAS_TO_BENCH: dict[str, str] = {
    alias: bench_field
    for bench_field, aliases in _NAME_PATTERNS.items()
    for alias in aliases
}

# Params that should always be skipped
_SKIP_PARAMS: set[str] = {"self", "cls", "request", "db", "response"}


def _infer_bench_field(param_name: str) -> str | None:
    """Return the bench field name for a given parameter name, or None."""
    if param_name in BENCH_FIELDS:
        return param_name
    return _ALIAS_TO_BENCH.get(param_name)


def _is_pydantic_model(annotation: Any) -> bool:
    try:
        from pydantic import BaseModel  # type: ignore[import-untyped]
        return isinstance(annotation, type) and issubclass(annotation, BaseModel)
    except ImportError:
        return False


def _params_from_pydantic(model_class: Any) -> dict[str, inspect.Parameter]:
    """Expand a Pydantic model into a dict of name → mock Parameter."""
    try:
        fields = model_class.model_fields  # Pydantic v2
    except AttributeError:
        fields = model_class.__fields__  # Pydantic v1
    result: dict[str, inspect.Parameter] = {}
    for field_name, field in fields.items():
        # Build a mock Parameter with the field annotation
        try:
            annotation = field.annotation  # Pydantic v2
        except AttributeError:
            annotation = field.outer_type_  # Pydantic v1
        default = inspect.Parameter.empty
        try:
            if field.is_required():  # Pydantic v2
                pass
            else:
                default = field.default
        except AttributeError:
            if not field.required:  # Pydantic v1
                default = field.default
        result[field_name] = inspect.Parameter(
            field_name,
            inspect.Parameter.KEYWORD_ONLY,
            default=default,
            annotation=annotation,
        )
    return result


def build_request_template(
    func: Callable[..., Any],
    input_map: dict[str, str] | None = None,
) -> dict[str, Any]:
    """Build a request_template dict for Bench registration.

    Parameters
    ----------
    func:
        The handler function whose signature is inspected.
    input_map:
        Optional explicit mapping of ``{ "enterprise_field": "bench_field_or_static" }``.
        E.g. ``{"query": "user_input", "tenant_id": "acme", "context": "chat_history"}``.

    Returns
    -------
    dict
        Template like ``{"query": "{{user_input}}", "tenant_id": "acme", ...}``.
    """
    if input_map is not None:
        template: dict[str, Any] = {}
        for field, value in input_map.items():
            if value in BENCH_FIELDS:
                template[field] = f"{{{{{value}}}}}"
            else:
                template[field] = value
        return template

    # ── auto-infer from signature ──────────────────────────────────────────
    sig = inspect.signature(func)
    params: dict[str, inspect.Parameter] = {}

    for name, param in sig.parameters.items():
        if name in _SKIP_PARAMS:
            continue
        annotation = param.annotation
        if annotation is not inspect.Parameter.empty and _is_pydantic_model(annotation):
            params.update(_params_from_pydantic(annotation))
        else:
            params[name] = param

    template = {}
    first_str_param: str | None = None
    first_param: str | None = None
    user_input_mapped = False

    for name, param in params.items():
        if first_param is None:
            first_param = name
        ann = param.annotation
        if ann is not inspect.Parameter.empty and ann is str and first_str_param is None:
            first_str_param = name

        bench_field = _infer_bench_field(name)
        if bench_field is not None:
            template[name] = f"{{{{{bench_field}}}}}"
            if bench_field == "user_input":
                user_input_mapped = True
        else:
            # No bench field match — treat as an agent_args key.
            # The placeholder {{name}} is resolved from agent_args at run time,
            # letting each scenario/suite override the value independently.
            # If the param has a default, Bench falls back to it when agent_args
            # doesn't supply the key (handler receives its default automatically).
            template[name] = f"{{{{{name}}}}}"

    # If no user_input was mapped, pick first str param or first param
    if not user_input_mapped:
        fallback = first_str_param or first_param
        if fallback and fallback not in template:
            template[fallback] = "{{user_input}}"
        elif fallback and template.get(fallback) not in (f"{{{{user_input}}}}", ):
            template[fallback] = "{{user_input}}"

    return template
