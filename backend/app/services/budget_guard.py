"""The spend cap. Every call to an AI provider goes through ``BudgetGuard.run``.

Contract: docs/architecture/interfaces/budget-guard.md (constraint C-09).
"""
from __future__ import annotations

import logging
from collections.abc import Callable
from contextvars import ContextVar
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from typing import TypeVar

from sqlalchemy import Engine
from sqlalchemy.orm import Session

from app.config import Settings
from app.models import AIUsageEvent
from app.repositories.usage import UsageRepository
from app.services.ai_usage import MICRO, PriceUnknownError, Usage, cost_micro_usd
from app.services.notifications import send_notification

logger = logging.getLogger(__name__)
T = TypeVar("T")


class BudgetExhaustedError(Exception):
    """The monthly AI budget is spent; the provider was not called."""


class UserBudgetExhaustedError(BudgetExhaustedError):
    """This user has used their share for today; the provider was not called."""


@dataclass(frozen=True)
class UsageContext:
    """Who is spending, and which database holds the ledger, for the current request."""
    user_id: str | None
    engine: Engine
    # The most this user may spend per UTC day, in micro-USD. None means no per-user limit.
    daily_limit_micro_usd: int | None = None


usage_context: ContextVar[UsageContext | None] = ContextVar("ai_usage_context", default=None)


@dataclass(frozen=True)
class BudgetStatus:
    month_start: datetime
    budget_micro_usd: int
    spent_micro_usd: int

    @property
    def remaining_micro_usd(self) -> int:
        return max(0, self.budget_micro_usd - self.spent_micro_usd)


def month_bounds(now: datetime) -> tuple[datetime, datetime]:
    """The UTC calendar month containing ``now`` as [start, next_start)."""
    current = now.astimezone(UTC)
    start = current.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    next_start = start.replace(year=start.year + 1, month=1) if start.month == 12 else start.replace(month=start.month + 1)
    return start, next_start


class BudgetGuard:
    def __init__(self, settings: Settings, *, engine: Engine | None = None,
                 clock: Callable[[], datetime] = lambda: datetime.now(UTC)) -> None:
        self.settings = settings
        self._engine = engine
        self._clock = clock

    @property
    def budget_micro_usd(self) -> int:
        return int(self.settings.ai_monthly_budget_usd * MICRO)

    def _resolve_engine(self) -> Engine:
        context = usage_context.get()
        if self._engine is not None:
            return self._engine
        if context is not None:
            return context.engine
        from app.db.session import engine  # the process-wide engine, for scripts outside a request
        return engine

    def status(self) -> BudgetStatus:
        start, end = month_bounds(self._clock())
        with Session(self._resolve_engine()) as db:
            spent = UsageRepository(db).spent_micro_usd(start, end)
        return BudgetStatus(month_start=start, budget_micro_usd=self.budget_micro_usd, spent_micro_usd=spent)

    def user_spent_today(self, user_id: str) -> int:
        now = self._clock().astimezone(UTC)
        start = now.replace(hour=0, minute=0, second=0, microsecond=0)
        with Session(self._resolve_engine()) as db:
            return UsageRepository(db).spent_micro_usd(start, start + timedelta(days=1), user_id=user_id)

    def run(self, *, purpose: str, worst_case: Usage, call: Callable[[], T],
            measure: Callable[[T], Usage | None], billed_on_error: Callable[[Exception], bool] = lambda _exc: False) -> T:
        """Check the budget, make the provider call, record what it cost.

        ``worst_case`` is the most this call could consume and is what the check uses.
        ``measure`` reads the actual usage from the provider's response.
        ``billed_on_error`` says whether a failed call may still have been billed.
        """
        try:
            worst_cost = cost_micro_usd(worst_case, self.settings.ai_price_table)
        except PriceUnknownError:
            logger.error("AI call refused: no price configured for model %s", worst_case.model)
            raise
        before = self.status()
        if before.spent_micro_usd + worst_cost > before.budget_micro_usd:
            raise BudgetExhaustedError()
        context = usage_context.get()
        if context is not None and context.user_id and context.daily_limit_micro_usd is not None:
            if self.user_spent_today(context.user_id) + worst_cost > context.daily_limit_micro_usd:
                raise UserBudgetExhaustedError()
        try:
            result = call()
        except Exception as exc:
            if billed_on_error(exc):
                self._record(purpose, worst_case, worst_cost, estimated=True, before=before)
            raise
        usage = measure(result)
        if usage is None:
            self._record(purpose, worst_case, worst_cost, estimated=True, before=before)
            return result
        try:
            cost = cost_micro_usd(usage, self.settings.ai_price_table)
        except PriceUnknownError:
            # The provider answered with a model we have no price for: charge the checked worst case.
            self._record(purpose, usage, worst_cost, estimated=True, before=before)
            return result
        self._record(purpose, usage, cost, estimated=False, before=before)
        return result

    def _record(self, purpose: str, usage: Usage, cost: int, *, estimated: bool, before: BudgetStatus) -> None:
        context = usage_context.get()
        with Session(self._resolve_engine()) as db:
            UsageRepository(db).add(AIUsageEvent(
                created_at=self._clock(), user_id=context.user_id if context else None, purpose=purpose[:100],
                provider=usage.provider, model=usage.model, input_tokens=usage.input_tokens,
                output_tokens=usage.output_tokens, cache_write_tokens=usage.cache_write_tokens,
                cache_read_tokens=usage.cache_read_tokens, stt_ms=usage.stt_ms,
                cost_micro_usd=cost, estimated=estimated,
            ))
            db.commit()
        self._alert(before.spent_micro_usd, before.spent_micro_usd + cost)

    def _alert(self, before: int, after: int) -> None:
        budget = self.budget_micro_usd
        if budget <= 0:
            return
        for fraction in (self.settings.ai_budget_alert_fraction, 1.0):
            threshold = int(budget * fraction)
            if before < threshold <= after:
                text = f"AI budget: {after / MICRO:.2f} of {budget / MICRO:.2f} USD used this month ({fraction:.0%} threshold)."
                try:
                    send_notification(self.settings, text)
                except Exception:  # an alert must never break the request that triggered it
                    logger.exception("Budget alert could not be sent")
