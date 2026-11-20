"""The spend cap seen through the HTTP API (C-09, Q-1, Q-2, Q-7)."""
from datetime import UTC, datetime
from types import SimpleNamespace

import httpx
import pytest
from sqlalchemy import select

from app.config import Settings, get_settings
from app.main import app
from app.models import AIUsageEvent, User
from app.schemas.ai_usage import ModelPrice
from app.schemas.topics import TopicTitleTranslation
from app.services.ai_adapter import get_ai_provider
from app.services.ai_usage import Usage
from app.services.anthropic_adapter import AnthropicStructuredProvider
from app.services.auth_service import LEGACY_USER_ID
from app.services.budget_guard import BudgetGuard, UsageContext, UserBudgetExhaustedError, usage_context
from app.services.elevenlabs_adapter import ElevenLabsTranscriptionProvider
from app.services.transcription_adapter import get_transcription_provider

PRICES = {"grading": ModelPrice(input_per_mtok=2, output_per_mtok=10), "utility": ModelPrice(input_per_mtok=0.1, output_per_mtok=0.5),
          "stt": ModelPrice(audio_per_minute=0.006)}


def configure(budget: float = 25, **overrides) -> Settings:
    settings = Settings(_env_file=None, anthropic_api_key="k", anthropic_grading_model="grading", anthropic_utility_model="utility",
                        elevenlabs_api_key="k", elevenlabs_stt_model="stt", ai_price_table=PRICES, ai_monthly_budget_usd=budget, **overrides)
    app.dependency_overrides[get_settings] = lambda: settings
    return settings


class RecordingMessages:
    def __init__(self) -> None:
        self.calls = 0

    def parse(self, **kwargs):
        self.calls += 1
        return SimpleNamespace(parsed_output=TopicTitleTranslation(source_language="ru", translated_title="Bank"), stop_reason="end_turn",
                               model=kwargs["model"], usage=SimpleNamespace(input_tokens=100, output_tokens=10,
                                                                            cache_creation_input_tokens=0, cache_read_input_tokens=0))


def use_claude(settings: Settings) -> RecordingMessages:
    messages = RecordingMessages()
    provider = AnthropicStructuredProvider(settings)
    provider._client = SimpleNamespace(messages=messages)
    app.dependency_overrides[get_ai_provider] = lambda: provider
    return messages


def make_premium(db_session) -> None:
    user = db_session.get(User, LEGACY_USER_ID)
    user.access_tier = "premium"
    db_session.commit()


def ledger(db_session) -> list[AIUsageEvent]:
    db_session.expire_all()
    return list(db_session.scalars(select(AIUsageEvent)))


def test_ai_call_made_through_the_api_is_attributed_to_the_signed_in_user(api_client, db_session):
    make_premium(db_session)
    messages = use_claude(configure())
    response = api_client.post("/api/topics", json={"title_ru": "Банк"})
    assert response.status_code in (200, 201), response.text
    assert messages.calls == 1
    [event] = ledger(db_session)
    assert (event.user_id, event.model, event.purpose) == (LEGACY_USER_ID, "utility", "topic_title_translation_v1.md")


def test_spent_monthly_budget_stops_ai_calls_but_not_the_app(api_client, db_session):
    make_premium(db_session)
    messages = use_claude(configure(budget=0))
    response = api_client.post("/api/topics", json={"title_ru": "Банк"})
    assert messages.calls == 0 and ledger(db_session) == []
    assert response.status_code == 503
    detail = response.json()["detail"]
    # ADR-0008: the code is unchanged for released clients; the budget reason is added.
    assert detail["code"] == "topic_translation_unavailable"
    assert detail["failure"]["reason"] == "budget_exhausted"
    assert detail["retryable"] is False
    assert api_client.get("/api/topics").status_code == 200
    assert api_client.get("/api/auth/me").status_code == 200


def test_spent_budget_on_transcription_returns_a_closed_code_without_sending_audio(api_client, db_session):
    settings = configure(budget=0)
    sent = []
    provider = ElevenLabsTranscriptionProvider(settings, transport=httpx.MockTransport(lambda r: sent.append(r) or httpx.Response(200, json={"text": "x"})))
    app.dependency_overrides[get_transcription_provider] = lambda: provider
    session = api_client.post("/api/sessions/start", json={"topic_id": api_client.get("/api/topics").json()[0]["id"]}).json()
    exercise_id = (session.get("exercise") or session.get("first_exercise") or session)["id"] if "exercise_id" not in session else session["exercise_id"]
    response = api_client.post("/api/transcriptions", data={"exercise_id": exercise_id},
                               files={"audio": ("answer.webm", b"synthetic", "audio/webm")})
    detail = response.json()["detail"]
    assert response.status_code == 503 and detail["code"] == "transcription_budget_exhausted"
    assert detail["failure"]["reason"] == "budget_exhausted" and detail["retryable"] is False
    assert sent == []


def test_one_user_cannot_spend_past_their_daily_share(db_session):
    settings = Settings(_env_file=None, ai_price_table=PRICES, ai_monthly_budget_usd=25)
    guard = BudgetGuard(settings, engine=db_session.get_bind(), clock=lambda: datetime(2026, 11, 20, 12, tzinfo=UTC))
    call = Usage(provider="p", model="grading", input_tokens=1000, output_tokens=1000)  # 12_000 micro-USD
    made = 0
    token = usage_context.set(UsageContext("user-a", db_session.get_bind(), daily_limit_micro_usd=30_000))
    try:
        with pytest.raises(UserBudgetExhaustedError):
            for _ in range(10):
                guard.run(purpose="grading", worst_case=call, call=lambda: 1, measure=lambda _r: call)
                made += 1
    finally:
        usage_context.reset(token)
    assert made == 2
    # Another user, and the same user on the next day, are unaffected.
    token = usage_context.set(UsageContext("user-b", db_session.get_bind(), daily_limit_micro_usd=30_000))
    try:
        guard.run(purpose="grading", worst_case=call, call=lambda: 1, measure=lambda _r: call)
    finally:
        usage_context.reset(token)
    tomorrow = BudgetGuard(settings, engine=db_session.get_bind(), clock=lambda: datetime(2026, 11, 21, 0, 1, tzinfo=UTC))
    assert tomorrow.user_spent_today("user-a") == 0


def test_admin_sees_month_to_date_spend_and_learners_do_not(api_client, db_session):
    configure(budget=25)
    assert api_client.get("/api/admin/usage").status_code == 403
    db_session.add(AIUsageEvent(created_at=datetime.now(UTC), purpose="grading", provider="anthropic", model="grading", cost_micro_usd=1_250_000))
    db_session.get(User, LEGACY_USER_ID).role = "admin"
    db_session.commit()
    body = api_client.get("/api/admin/usage").json()
    assert (body["budget_usd"], body["spent_usd"], body["remaining_usd"]) == (25, 1.25, 23.75)
