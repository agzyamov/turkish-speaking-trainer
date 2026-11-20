import unicodedata
from unittest.mock import Mock

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.config import Settings, get_settings
from app.main import app
from app.models import Attempt, AttemptRequest, Exercise
from app.services.transcription_adapter import get_transcription_provider
from app.services.transcription_assistance_adapter import get_transcription_assistance_provider
from app.services.turkish_text import has_unexpected_letter_script, latin_for_evaluation
from tests.fakes import FakeTranscriptionProvider


def _create_exercise(api_client: TestClient) -> str:
    session_response = api_client.post("/api/sessions", json={"topic_id": "bank", "length": 3})
    session_id = session_response.json()["id"]
    exercise_response = api_client.post(f"/api/sessions/{session_id}/next-exercise")
    return exercise_response.json()["id"]


def _settings(**overrides) -> Settings:
    return Settings(_env_file=None, elevenlabs_api_key="server-secret", elevenlabs_stt_model="model-from-env", **overrides)


def test_transcribes_supported_audio_without_persisting_it(api_client: TestClient) -> None:
    exercise_id = _create_exercise(api_client)
    provider = FakeTranscriptionProvider(text="Hesap açmak istiyorum.")
    app.dependency_overrides[get_transcription_provider] = lambda: provider
    app.dependency_overrides[get_settings] = lambda: _settings(max_audio_bytes=100_000)

    response = api_client.post(
        "/api/transcriptions",
        data={"exercise_id": exercise_id},
        files={"audio": ("speech.webm", b"webm-audio-bytes", "audio/webm")},
    )

    assert response.status_code == 200
    assert response.json() == {"text": "Hesap açmak istiyorum."}
    assert provider.calls == [{
        "audio": b"webm-audio-bytes",
        "filename": "speech.webm",
        "content_type": "audio/webm",
    }]
    assert "server-secret" not in response.text


def test_transcription_normalizes_combining_marks_without_changing_letters(api_client: TestClient) -> None:
    exercise_id = _create_exercise(api_client)
    spoken = "Çay içmek İSTİYORUM, ılık olsun."
    provider = FakeTranscriptionProvider(text=unicodedata.normalize("NFD", spoken))
    app.dependency_overrides[get_transcription_provider] = lambda: provider
    app.dependency_overrides[get_settings] = lambda: _settings()

    response = api_client.post(
        "/api/transcriptions", data={"exercise_id": exercise_id},
        files={"audio": ("speech.webm", b"webm-audio-bytes", "audio/webm")},
    )

    assert response.status_code == 200
    # One Unicode form; casing, dotted/dotless i and punctuation are the learner's own (C-18).
    assert response.json() == {"text": spoken}


@pytest.mark.parametrize("text", [
    "Hesap açmak истиyorum.",  # Cyrillic letters that do not look like Latin ones
    "Hesаp açmak istiyorum.",  # one look-alike Cyrillic letter inside a Latin word
    "Хесап ачмак истийорум.",  # the whole answer in Cyrillic
    "Hesap açmαk istiyorum.",  # Greek
    "Hesap açmak istiyorum مرحبا",  # Arabic
])
@pytest.mark.parametrize("assistance_enabled", [False, True])
def test_transcription_returns_non_latin_letters_for_review(api_client: TestClient, db_session: Session, text, assistance_enabled) -> None:
    exercise_id = _create_exercise(api_client)
    provider = FakeTranscriptionProvider(text=text)
    assistance = Mock(is_available=True)
    app.dependency_overrides[get_transcription_assistance_provider] = lambda: assistance
    app.dependency_overrides[get_transcription_provider] = lambda: provider
    app.dependency_overrides[get_settings] = lambda: _settings()

    response = api_client.post(
        "/api/transcriptions", data={"exercise_id": exercise_id, "assistance_enabled": str(assistance_enabled).lower()},
        files={"audio": ("speech.webm", b"webm-audio-bytes", "audio/webm")},
    )

    assert response.status_code == 200
    assert response.json() == {"text": text, "review_required": True}
    assistance.analyze.assert_not_called()
    if not has_unexpected_letter_script(latin_for_evaluation(text)):
        # Look-alike letters inside Latin words are repaired for grading, so this answer is not rejected for its script.
        retried = api_client.post("/api/attempts", json={"exercise_id": exercise_id, "transcript_tr": text})
        assert retried.json().get("detail", {}) != {"code": "transcript_unexpected_script"}
        return
    rejected = api_client.post("/api/attempts", json={"exercise_id": exercise_id, "transcript_tr": text})
    assert rejected.status_code == 422
    assert rejected.json() == {"detail": {"code": "transcript_unexpected_script"}}
    assert db_session.scalar(select(func.count()).select_from(Attempt)) == 0
    assert db_session.scalar(select(func.count()).select_from(AttemptRequest)) == 0
    # The rejection leaves quota/session usable for the edited answer.
    canonical = db_session.get(Exercise, exercise_id).target_hints_json["canonical_tr"]
    accepted = api_client.post("/api/attempts", json={"exercise_id": exercise_id, "transcript_tr": canonical})
    assert accepted.status_code == 201


def test_rejects_unsupported_audio_before_provider_call(api_client: TestClient) -> None:
    exercise_id = _create_exercise(api_client)
    provider = FakeTranscriptionProvider()
    app.dependency_overrides[get_transcription_provider] = lambda: provider

    response = api_client.post(
        "/api/transcriptions",
        data={"exercise_id": exercise_id},
        files={"audio": ("speech.txt", b"not-audio", "text/plain")},
    )

    assert response.status_code == 415
    assert provider.calls == []


def test_rejects_audio_over_configured_limit(api_client: TestClient) -> None:
    exercise_id = _create_exercise(api_client)
    provider = FakeTranscriptionProvider()
    app.dependency_overrides[get_transcription_provider] = lambda: provider
    app.dependency_overrides[get_settings] = lambda: _settings(max_audio_bytes=10_000)

    response = api_client.post(
        "/api/transcriptions",
        data={"exercise_id": exercise_id},
        files={"audio": ("speech.webm", b"x" * 10_001, "audio/webm")},
    )

    assert response.status_code == 413
    assert provider.calls == []


def test_reports_unavailable_transcription(api_client: TestClient) -> None:
    exercise_id = _create_exercise(api_client)

    response = api_client.post(
        "/api/transcriptions",
        data={"exercise_id": exercise_id},
        files={"audio": ("speech.webm", b"audio", "audio/webm")},
    )

    assert response.status_code == 503
    assert response.json()["detail"]["code"] == "transcription_not_configured"
    assert response.json()["detail"]["failure"]["kind"] == "external_model"
    assert response.json()["detail"]["failure"]["reason"] == "not_configured"


def test_rejects_oversized_request_before_multipart_can_spool(api_client: TestClient) -> None:
    response = api_client.post(
        "/api/transcriptions",
        data={"exercise_id": "exercise"},
        files={"audio": ("speech.webm", b"x" * 1_064_001, "audio/webm")},
    )

    assert response.status_code == 413
    assert response.json() == {"detail": "Audio is too large"}
