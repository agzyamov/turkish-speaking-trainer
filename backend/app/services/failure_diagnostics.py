"""Safe failure taxonomy. No request text, provider bodies, tokens or audio in logs."""
import json
import logging
from contextvars import ContextVar
from typing import Literal
from uuid import uuid4

from pydantic import BaseModel, ConfigDict

diagnostic_context: ContextVar[str | None] = ContextVar("diagnostic_id", default=None)
logger = logging.getLogger("app.failures")


class FailureDiagnostic(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)
    kind: Literal["external_model", "response_parse", "response_return"]
    stage: Literal["configuration", "budget", "provider_request", "structured_output", "target_policy", "grounding", "persistence", "serialization", "server_return"]
    reason: Literal["not_configured", "budget_exhausted", "user_daily_budget_exhausted", "price_unknown", "timeout", "connection", "rate_limit", "quota", "authentication", "provider_status", "provider_failure", "model_refusal", "incomplete_output", "canonical_changed", "invalid_schema", "internal_parse_failure", "missing_output", "script_violation", "unknown_skill", "invalid_severity", "unsupported_evidence", "non_lexical_correction", "contradictory_verdict", "missing_issue", "persistence_failed", "serialization_failed", "server_return_failed"]
    retryable: bool
    diagnostic_id: str
    provider_status: int | None = None


def diagnostic(kind, stage, reason, *, retryable=True, provider_status=None) -> FailureDiagnostic:
    return FailureDiagnostic(kind=kind, stage=stage, reason=reason, retryable=retryable,
                             diagnostic_id=diagnostic_context.get() or str(uuid4()), provider_status=provider_status)


class DiagnosticFailure(RuntimeError):
    def __init__(self, message: str, failure: FailureDiagnostic):
        super().__init__(message)
        self.failure = failure


def _sdk_error_types(name: str) -> tuple[type[BaseException], ...]:
    """The same-named error class from each provider SDK that is installed."""
    import importlib
    found: list[type[BaseException]] = []
    for sdk in ("anthropic",):
        try:
            found.append(getattr(importlib.import_module(sdk), name))
        except (ImportError, AttributeError):
            continue
    return tuple(found)


def is_provider_timeout(exc: BaseException) -> bool:
    return isinstance(exc, (TimeoutError, *_sdk_error_types("APITimeoutError")))


def classify_provider_error(exc: Exception) -> FailureDiagnostic:
    from pydantic import ValidationError
    APIConnectionError = _sdk_error_types("APIConnectionError")
    APIStatusError = _sdk_error_types("APIStatusError")
    APIResponseValidationError = _sdk_error_types("APIResponseValidationError")
    if is_provider_timeout(exc):
        return diagnostic("external_model", "provider_request", "timeout")
    if isinstance(exc, APIConnectionError):
        return diagnostic("external_model", "provider_request", "connection")
    if isinstance(exc, APIStatusError):
        status = exc.status_code
        body = exc.body if isinstance(exc.body, dict) else {}
        error = body.get("error") if isinstance(body.get("error"), dict) else {}
        code = body.get("code") or error.get("code") or error.get("type")
        reason = "quota" if code in {"insufficient_quota", "billing_error"} else "authentication" if status in (401, 403) else "rate_limit" if status == 429 else "provider_status"
        return diagnostic("external_model", "provider_request", reason,
                          retryable=reason not in {"quota", "authentication"} and (status == 429 or status >= 500), provider_status=status)
    if isinstance(exc, (ValidationError, *APIResponseValidationError, ValueError, TypeError, AttributeError, KeyError)):
        return diagnostic("response_parse", "structured_output", "invalid_schema")
    return diagnostic("response_parse", "structured_output", "internal_parse_failure", retryable=False)


def record_failure(failure: FailureDiagnostic, *, attempt: int | None = None) -> None:
    """Correlate safe platform logs with opt-in owner diagnostics, including post-AI guards."""
    payload = failure.model_dump(mode="json")
    if attempt is not None:
        payload["attempt"] = attempt
    emit = logger.warning if attempt is not None else logger.error
    emit("application_failure %s", json.dumps(payload, separators=(",", ":")))
    # Reuse existing owner authorization, retention and disable/delete semantics.
    from app.services.model_debug import DebugCapture
    capture = DebugCapture("application.failure", "", payload, None)
    capture.finish(DiagnosticFailure("Classified application failure", failure))
