import pytest
from sqlalchemy import select

from app.config import get_settings
from app.main import app
from app.models import ModelDebugSetting, User
from app.schemas.ai_usage import ModelPrice
from app.services.debug_mode import DebugModeService
from app.services.transcription_adapter import get_transcription_provider
from app.services.transcription_settings import TranscriptionSettingsService
from tests.providers import elevenlabs_provider, provider_settings
from tests.test_transcriptions_api import _create_exercise

PATH = "/api/admin/model-debug/transcription"
PRICES = {"env-default": ModelPrice(audio_per_minute=0.006), "env-alternative": ModelPrice(audio_per_minute=0.006)}


def configure(db_session, *, owner=True):
    user = db_session.scalar(select(User))
    user.role = "admin"
    user.email = "owner@example.com" if owner else "other@example.com"
    db_session.commit()
    settings = provider_settings(elevenlabs_api_key="server-secret", elevenlabs_stt_model="env-default",
                                 elevenlabs_stt_models=["env-alternative"], ai_price_table=PRICES)
    app.dependency_overrides[get_settings] = lambda: settings
    return user, settings


def transcribe(api_client, exercise_id):
    return api_client.post("/api/transcriptions", data={"exercise_id": exercise_id},
        files={"audio": ("speech.webm", b"synthetic", "audio/webm")})


def test_selection_persists_independently_of_debug_and_rejects_unknown(api_client, db_session):
    user, settings = configure(db_session)
    assert api_client.get(PATH).json()["options"] == ["env-alternative", "env-default"]
    result = api_client.patch(PATH, json={"model": "env-alternative"})
    assert result.status_code == 200
    assert result.json()["effective_model"] == "env-alternative"
    assert api_client.get(PATH).json()["selected_model"] == "env-alternative"
    assert not db_session.get(ModelDebugSetting, user.id).enabled
    DebugModeService(db_session, user.id).change(True)
    DebugModeService(db_session, user.id).change(False)
    assert api_client.get(PATH).json()["selected_model"] == "env-alternative"
    assert api_client.patch(PATH, json={"model": "unconfigured"}).status_code == 422
    assert api_client.get(PATH).json()["effective_model"] == "env-alternative"
    # Removed allowlist entries and revoked ownership safely fall back to default.
    settings.elevenlabs_stt_models = []
    assert api_client.get(PATH).json()["effective_model"] == "env-default"
    assert api_client.patch(PATH, json={"model": None}).json()["selected_model"] is None


@pytest.mark.parametrize("role,email", [("user", "owner@example.com"), ("admin", "other@example.com")])
def test_other_users_cannot_read_or_change_experiment(api_client, db_session, role, email):
    user, settings = configure(db_session)
    TranscriptionSettingsService(db_session, settings, user.id).change("env-alternative")
    user.role, user.email = role, email
    db_session.commit()
    assert api_client.get(PATH).status_code == 403
    assert api_client.patch(PATH, json={"model": "env-alternative"}).status_code == 403
    service = TranscriptionSettingsService(db_session, settings, user.id)
    assert service.selected() is None and service.read().effective_model == "env-default"


def test_actual_request_uses_owner_model_and_target_language(api_client, db_session):
    _user, settings = configure(db_session)
    exercise_id = _create_exercise(api_client)
    assert api_client.patch(PATH, json={"model": "env-alternative"}).status_code == 200
    provider, requests = elevenlabs_provider(text="Bir kahve lütfen.", settings=settings)
    app.dependency_overrides[get_transcription_provider] = lambda: provider
    result = transcribe(api_client, exercise_id)
    assert result.status_code == 200
    assert result.json()["text"] == "Bir kahve lütfen."
    [request] = requests
    assert b'name="model_id"\r\n\r\nenv-alternative' in request.content
    assert b'name="language_code"\r\n\r\ntr' in request.content
    assert provider.settings.elevenlabs_stt_model == "env-default"  # No shared singleton mutation.
    assert settings.elevenlabs_stt_model == "env-default"


def test_global_env_default_and_target_language_apply_to_regular_users(api_client, db_session):
    user, settings = configure(db_session)
    TranscriptionSettingsService(db_session, settings, user.id).change("env-alternative")
    user.role = "user"
    db_session.commit()
    exercise_id = _create_exercise(api_client)
    provider, requests = elevenlabs_provider(text="Bir kahve lütfen.", settings=settings)
    app.dependency_overrides[get_transcription_provider] = lambda: provider
    response = transcribe(api_client, exercise_id)
    assert response.status_code == 200
    [request] = requests
    assert b'name="model_id"\r\n\r\nenv-default' in request.content
    assert b'name="language_code"\r\n\r\ntr' in request.content
