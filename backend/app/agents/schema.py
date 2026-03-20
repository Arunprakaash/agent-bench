"""
Derive agent constructor arg schema from module + class for UI form generation.

Returns a list of { name, type, required, default } so the UI can render
relevant inputs. Scenario agent_args are scenario-specific overrides and
are never written back to the agent.
"""

import importlib
import inspect
import logging
from typing import Any

logger = logging.getLogger(__name__)

# Map common annotations to UI-friendly type names
_TYPE_MAP = {
    str: "string",
    int: "integer",
    float: "number",
    bool: "boolean",
    list: "array",
    dict: "object",
}


def _annotation_to_type(annotation: Any) -> str:
    if annotation is inspect.Parameter.empty:
        return "string"
    if hasattr(annotation, "__origin__"):
        origin = annotation.__origin__
        if origin is not None:
            if origin is list:
                return "array"
            if origin is dict:
                return "object"
    if hasattr(annotation, "__name__"):
        return _TYPE_MAP.get(annotation, "string")
    return "string"


def derive_arg_schema(module_path: str, class_name: str) -> list[dict[str, Any]] | None:
    """
    Import the agent class and inspect its __init__ signature.
    Returns a list of { "name", "type", "required", "default" } for each
    parameter (excluding self, *args, **kwargs), or None if import/inspect fails.
    """
    try:
        mod = importlib.import_module(module_path)
        cls = getattr(mod, class_name, None)
        if cls is None:
            logger.warning("Class %s not found in %s", class_name, module_path)
            return None
        sig = inspect.signature(cls.__init__)
        out: list[dict[str, Any]] = []
        for name, param in sig.parameters.items():
            if name == "self":
                continue
            if param.kind in (inspect.Parameter.VAR_KEYWORD, inspect.Parameter.VAR_POSITIONAL):
                continue
            required = param.default is inspect.Parameter.empty
            entry: dict[str, Any] = {
                "name": name,
                "type": _annotation_to_type(param.annotation),
                "required": required,
            }
            if not required:
                entry["default"] = param.default
            out.append(entry)
        return out if out else None
    except Exception as e:
        logger.warning("Could not derive arg_schema for %s.%s: %s", module_path, class_name, e)
        return None
