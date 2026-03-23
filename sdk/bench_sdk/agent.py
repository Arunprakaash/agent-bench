"""Main decorator for wrapping agent endpoints with Bench interception."""
from __future__ import annotations

import asyncio
import functools
import inspect
import logging
import os
from typing import Any, Callable

from .mapper import build_request_template
from .normalizer import normalize_response
from .registration import upsert_agent

logger = logging.getLogger(__name__)


def _is_async(func: Callable[..., Any]) -> bool:
    return asyncio.iscoroutinefunction(func)


def _wrap_fastapi(
    func: Callable[..., Any],
    output_map: dict[str, Any] | Callable[..., Any] | None,
) -> Callable[..., Any]:
    """Wrap an async FastAPI handler."""
    try:
        from fastapi import Request  # type: ignore[import-untyped]
    except ImportError as exc:
        raise ImportError("fastapi is required for async handler wrapping. Install bench-sdk[fastapi].") from exc

    @functools.wraps(func)
    async def wrapper(*args: Any, **kwargs: Any) -> Any:
        # Extract the injected `request` kwarg (default None if not provided)
        request: Any = kwargs.pop("request", None)
        is_bench = False
        if request is not None:
            try:
                is_bench = request.headers.get("x-bench-run") == "true"
            except Exception:
                pass

        result = await func(*args, **kwargs)

        if is_bench:
            return {"events": normalize_response(result, output_map)}
        return result

    # Inject `request: Request` into signature if not already present
    sig = inspect.signature(func)
    has_request = any(
        p.annotation is Request
        for p in sig.parameters.values()
    )
    if not has_request:
        request_param = inspect.Parameter(
            "request",
            inspect.Parameter.KEYWORD_ONLY,
            default=None,
            annotation=Request,
        )
        new_params = list(sig.parameters.values()) + [request_param]
        wrapper.__signature__ = sig.replace(parameters=new_params)  # type: ignore[attr-defined]

    return wrapper


def _wrap_flask(
    func: Callable[..., Any],
    output_map: dict[str, Any] | Callable[..., Any] | None,
) -> Callable[..., Any]:
    """Wrap a sync Flask handler."""
    @functools.wraps(func)
    def wrapper(*args: Any, **kwargs: Any) -> Any:
        is_bench = False
        try:
            from flask import request as flask_request  # type: ignore[import-untyped]
            is_bench = flask_request.headers.get("x-bench-run") == "true"
        except Exception:
            pass

        result = func(*args, **kwargs)

        if is_bench:
            return {"events": normalize_response(result, output_map)}
        return result

    return wrapper


class BenchAgent:
    """Holds Bench configuration and wraps handler endpoints."""

    def __init__(
        self,
        bench_url: str,
        bench_token: str,
        name: str,
        *,
        input_map: dict[str, str] | None = None,
        output_map: dict[str, str] | Callable[..., Any] | None = None,
        register: str = "startup",
        endpoint: str | None = None,
    ) -> None:
        self.bench_url = bench_url
        self.bench_token = bench_token
        self.name = name
        self.input_map = input_map
        self.output_map = output_map
        self.register_mode = register
        self._endpoint = endpoint or os.environ.get("BENCH_AGENT_ENDPOINT")

    # ── decorator usage ───────────────────────────────────────────────────

    def __call__(
        self,
        func: Callable[..., Any] | None = None,
        *,
        input_map: dict[str, str] | None = None,
        output_map: dict[str, str] | Callable[..., Any] | None = None,
    ) -> Any:
        """Use as ``@agent`` or ``@agent(input_map=..., output_map=...)``.

        When called with keyword arguments, returns a decorator.
        When called directly on a function, wraps it immediately.
        """
        if func is not None:
            return self._wrap(func)
        return lambda f: self._wrap(f, input_map=input_map, output_map=output_map)

    def _wrap(
        self,
        func: Callable[..., Any],
        *,
        input_map: dict[str, str] | None = None,
        output_map: dict[str, str] | Callable[..., Any] | None = None,
    ) -> Callable[..., Any]:
        """Wrap the function with Bench interception and optionally trigger registration."""
        effective_input_map = input_map or self.input_map
        effective_output_map = output_map or self.output_map

        if _is_async(func):
            wrapped = _wrap_fastapi(func, effective_output_map)
        else:
            wrapped = _wrap_flask(func, effective_output_map)

        request_template = build_request_template(func, effective_input_map)

        if self.register_mode == "startup":
            self._schedule_registration(func, request_template)
        elif self.register_mode == "lazy":
            self._print_config(func, request_template)
        # "manual" → do nothing; user calls agent.register() explicitly

        return wrapped

    def _schedule_registration(
        self,
        func: Callable[..., Any],
        request_template: dict[str, Any],
    ) -> None:
        """Schedule registration as soon as an event loop is available."""
        endpoint = self._endpoint
        if not endpoint:
            logger.warning(
                "bench-sdk: endpoint not set for agent '%s'. "
                "Set BENCH_AGENT_ENDPOINT env var or pass endpoint= to bench_agent().",
                self.name,
            )
            return

        async def _do_register() -> None:
            try:
                agent_id = await upsert_agent(
                    bench_url=self.bench_url,
                    bench_token=self.bench_token,
                    name=self.name,
                    endpoint=endpoint,
                    request_template=request_template,
                )
                logger.info("bench-sdk: registered agent '%s' with id=%s", self.name, agent_id)
            except Exception as exc:  # noqa: BLE001
                logger.warning("bench-sdk: registration failed for agent '%s': %s", self.name, exc)

        try:
            loop = asyncio.get_running_loop()
            loop.create_task(_do_register())
        except RuntimeError:
            # No running loop — schedule for when one starts
            def _on_loop() -> None:
                try:
                    asyncio.ensure_future(_do_register())
                except Exception as exc:  # noqa: BLE001
                    logger.warning("bench-sdk: registration deferred task failed: %s", exc)

            try:
                loop = asyncio.get_event_loop()
                loop.call_soon(_on_loop)
            except RuntimeError:
                logger.warning(
                    "bench-sdk: could not schedule registration for agent '%s' (no event loop).",
                    self.name,
                )

    def _print_config(
        self,
        func: Callable[..., Any],
        request_template: dict[str, Any],
    ) -> None:
        """Print the Bench config to stdout (lazy registration mode)."""
        import json
        endpoint = self._endpoint or "<BENCH_AGENT_ENDPOINT>"
        config = {
            "name": self.name,
            "module": "bench_sdk",
            "agent_class": "sdk_agent",
            "provider_type": "rest_api",
            "connection_config": {
                "endpoint": endpoint,
                "request_template": request_template,
            },
        }
        print(f"[bench-sdk] Agent config for '{self.name}':")
        print(json.dumps(config, indent=2))

    async def register(
        self,
        func: Callable[..., Any],
        endpoint: str | None = None,
    ) -> str:
        """Manually trigger registration for the given handler.

        Returns the agent_id.
        """
        effective_endpoint = endpoint or self._endpoint
        if not effective_endpoint:
            raise ValueError(
                "endpoint must be provided or set via BENCH_AGENT_ENDPOINT env var."
            )
        request_template = build_request_template(func, self.input_map)
        return await upsert_agent(
            bench_url=self.bench_url,
            bench_token=self.bench_token,
            name=self.name,
            endpoint=effective_endpoint,
            request_template=request_template,
        )


def bench_agent(
    bench_url: str,
    bench_token: str,
    name: str,
    *,
    input_map: dict[str, str] | None = None,
    output_map: dict[str, str] | Callable[..., Any] | None = None,
    register: str = "startup",
    endpoint: str | None = None,
) -> Callable[[Callable[..., Any]], Callable[..., Any]]:
    """Convenience decorator that creates a :class:`BenchAgent` internally.

    Parameters
    ----------
    bench_url:
        Base URL of the Bench server (e.g. ``"https://bench.example.com"``).
    bench_token:
        API token for authenticating with Bench.
    name:
        Agent display name in Bench.
    input_map:
        Optional explicit ``{ "enterprise_field": "bench_field_or_static" }`` mapping.
        If not provided, the mapping is inferred from the handler's signature.
    output_map:
        Optional output mapping.  Either a callable that receives the raw response and
        returns a list of event dicts, or a dict ``{ "enterprise_field": "event_type" }``.
    register:
        When to register with Bench:
        - ``"startup"`` (default): schedule immediately on decoration.
        - ``"lazy"``: print config to stdout, don't call Bench.
        - ``"manual"``: do nothing; call ``BenchAgent.register()`` explicitly.
    endpoint:
        The URL Bench should call for this agent.  If not provided, falls back to
        the ``BENCH_AGENT_ENDPOINT`` environment variable.

    Example
    -------
    ::

        @bench_agent(
            bench_url="https://bench.example.com",
            bench_token="tok_...",
            name="my-agent",
            endpoint="https://api.example.com/chat",
        )
        async def chat(query: str, messages: list) -> dict:
            ...
    """
    agent = BenchAgent(
        bench_url=bench_url,
        bench_token=bench_token,
        name=name,
        input_map=input_map,
        output_map=output_map,
        register=register,
        endpoint=endpoint,
    )
    return agent  # type: ignore[return-value]
