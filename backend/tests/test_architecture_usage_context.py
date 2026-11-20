"""Every route that can reach an AI provider runs with the spend context (C-09, C-10).

Without ``ai_usage_context`` the budget guard would not know the user, so the per-user daily limit
would silently not apply. This walks the real application routes instead of trusting a list.
"""
from fastapi.routing import APIRoute

from app.api.dependencies import ai_usage_context
from app.main import app
from app.services.ai_adapter import get_ai_provider
from app.services.transcription_adapter import get_transcription_provider
from app.services.transcription_assistance_adapter import get_transcription_assistance_provider

PROVIDER_FACTORIES = {get_ai_provider, get_transcription_provider, get_transcription_assistance_provider}


def dependency_calls(dependant) -> set:
    calls = {dependant.call}
    for child in dependant.dependencies:
        calls |= dependency_calls(child)
    return calls


def effective_routes(routes, inherited: frozenset = frozenset()):
    """(route, dependency callables) pairs, including dependencies added when a router is included.

    FastAPI 0.165 wraps included routers; their routes and include-time dependencies live on the wrapper.
    """
    for route in routes:
        if isinstance(route, APIRoute):
            yield route, dependency_calls(route.dependant) | inherited
        elif hasattr(route, "original_router"):
            extra = frozenset(dep.dependency for dep in (route.include_context.dependencies or []))
            yield from effective_routes(route.original_router.routes, inherited | extra)


def test_every_route_that_can_reach_a_provider_has_the_usage_context():
    reaching = [(route, calls) for route, calls in effective_routes(app.routes) if calls & PROVIDER_FACTORIES]
    assert len(reaching) >= 7, "expected the AI routes listed in docs/architecture/interfaces/rest-api.md"
    missing = [f"{sorted(route.methods)} {route.path}" for route, calls in reaching if ai_usage_context not in calls]
    assert missing == []
