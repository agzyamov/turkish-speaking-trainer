"""The monthly spend cap (constraint C-09, quality Q-1)."""
from datetime import UTC, datetime

import pytest
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import Settings
from app.models import AIUsageEvent
from app.schemas.ai_usage import ModelPrice
from app.services.ai_usage import PriceUnknownError, Usage, cost_micro_usd
from app.services.budget_guard import BudgetExhaustedError, BudgetGuard, UsageContext, month_bounds, usage_context

PRICES = {
    "text-model": ModelPrice(input_per_mtok=2, output_per_mtok=10, cache_write_per_mtok=2.5, cache_read_per_mtok=0.2),
    "stt-model": ModelPrice(audio_per_minute=0.006),
}
WORST = Usage(provider="p", model="text-model", input_tokens=6000, output_tokens=4000)  # 52_000 micro-USD


def settings(budget: float = 25) -> Settings:
    return Settings(_env_file=None, ai_monthly_budget_usd=budget, ai_price_table=PRICES)


def guard(db_session: Session, budget: float = 25, now: datetime | None = None) -> BudgetGuard:
    return BudgetGuard(settings(budget), engine=db_session.get_bind(), clock=lambda: now or datetime(2026, 11, 20, tzinfo=UTC))


def rows(db_session: Session) -> list[AIUsageEvent]:
    db_session.expire_all()
    return list(db_session.scalars(select(AIUsageEvent)))


def test_cost_is_computed_from_configured_prices_and_rounds_up():
    usage = Usage(provider="p", model="text-model", input_tokens=1000, output_tokens=500, cache_write_tokens=100, cache_read_tokens=10)
    assert cost_micro_usd(usage, PRICES) == 1000 * 2 + 500 * 10 + 250 + 2
    assert cost_micro_usd(Usage(provider="p", model="stt-model", stt_ms=10_000), PRICES) == 1000
    assert cost_micro_usd(Usage(provider="p", model="stt-model", stt_ms=1), PRICES) == 1  # never rounds to free


def test_month_bounds_are_utc_calendar_months():
    assert month_bounds(datetime(2026, 12, 31, 23, 59, tzinfo=UTC)) == (datetime(2026, 12, 1, tzinfo=UTC), datetime(2027, 1, 1, tzinfo=UTC))


def test_call_within_budget_runs_and_records_measured_cost(db_session):
    actual = Usage(provider="p", model="text-model", input_tokens=1200, output_tokens=300)
    result = guard(db_session).run(purpose="grading", worst_case=WORST, call=lambda: "ok", measure=lambda _r: actual)
    assert result == "ok"
    [row] = rows(db_session)
    assert (row.purpose, row.cost_micro_usd, row.estimated, row.input_tokens) == ("grading", 1200 * 2 + 300 * 10, False, 1200)
    assert guard(db_session).status().spent_micro_usd == 5400


def test_exhausted_budget_refuses_without_calling_the_provider(db_session):
    calls = []
    tight = guard(db_session, budget=0.05)  # 50_000 micro-USD, below the 52_000 worst case
    with pytest.raises(BudgetExhaustedError):
        tight.run(purpose="grading", worst_case=WORST, call=lambda: calls.append(1), measure=lambda _r: None)
    assert calls == [] and rows(db_session) == []


def test_spend_never_passes_the_cap_across_sequential_calls(db_session):
    capped = guard(db_session, budget=0.12)
    made = 0
    for _ in range(10):
        try:
            capped.run(purpose="grading", worst_case=WORST, call=lambda: "ok", measure=lambda _r: WORST)
            made += 1
        except BudgetExhaustedError:
            break
    assert made == 2
    assert capped.status().spent_micro_usd <= capped.budget_micro_usd


def test_zero_budget_stops_every_call(db_session):
    with pytest.raises(BudgetExhaustedError):
        guard(db_session, budget=0).run(purpose="x", worst_case=WORST, call=lambda: "ok", measure=lambda _r: WORST)


def test_unknown_price_refuses_before_calling(db_session):
    calls = []
    with pytest.raises(PriceUnknownError):
        guard(db_session).run(purpose="x", worst_case=Usage(provider="p", model="unpriced"), call=lambda: calls.append(1), measure=lambda _r: None)
    assert calls == []


def test_missing_usage_is_charged_at_the_worst_case(db_session):
    guard(db_session).run(purpose="stt", worst_case=WORST, call=lambda: "ok", measure=lambda _r: None)
    [row] = rows(db_session)
    assert (row.cost_micro_usd, row.estimated) == (52_000, True)


def test_failed_call_is_charged_only_when_it_may_have_been_billed(db_session):
    def boom():
        raise TimeoutError

    with pytest.raises(TimeoutError):
        guard(db_session).run(purpose="x", worst_case=WORST, call=boom, measure=lambda _r: None)
    assert rows(db_session) == []
    with pytest.raises(TimeoutError):
        guard(db_session).run(purpose="x", worst_case=WORST, call=boom, measure=lambda _r: None,
                              billed_on_error=lambda exc: isinstance(exc, TimeoutError))
    [row] = rows(db_session)
    assert row.estimated is True and row.cost_micro_usd == 52_000


def test_new_month_starts_from_zero(db_session):
    guard(db_session, now=datetime(2026, 11, 30, 23, 0, tzinfo=UTC)).run(purpose="x", worst_case=WORST, call=lambda: 1, measure=lambda _r: WORST)
    assert guard(db_session, now=datetime(2026, 11, 30, 23, 30, tzinfo=UTC)).status().spent_micro_usd == 52_000
    assert guard(db_session, now=datetime(2026, 12, 1, 0, 0, tzinfo=UTC)).status().spent_micro_usd == 0


def test_user_and_ledger_database_come_from_the_request_context(db_session):
    token = usage_context.set(UsageContext(user_id="user-1", engine=db_session.get_bind()))
    try:
        BudgetGuard(settings()).run(purpose="x", worst_case=WORST, call=lambda: 1, measure=lambda _r: WORST)
    finally:
        usage_context.reset(token)
    assert rows(db_session)[0].user_id == "user-1"


def test_admin_is_alerted_once_at_each_threshold(db_session, monkeypatch):
    sent: list[str] = []
    monkeypatch.setattr("app.services.budget_guard.send_notification", lambda _settings, text: sent.append(text))
    capped = guard(db_session, budget=0.26)  # five worst-case calls fit: 52k each of 260k
    for _ in range(5):
        capped.run(purpose="x", worst_case=WORST, call=lambda: 1, measure=lambda _r: WORST)
    assert len(sent) == 2 and "80%" in sent[0] and "100%" in sent[1]
