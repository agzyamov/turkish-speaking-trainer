from fastapi import UploadFile
from pydantic import ValidationError
from sqlalchemy.orm import Session

from app.config import Settings
from app.repositories import ExerciseRepository
from app.repositories.transcriptions import TranscriptionReceiptRepository
from app.schemas import TranscriptionResponse
from app.schemas.transcriptions import TranscriptionAssistanceAnalysis
from app.services.ai_adapter import AIServiceError
from app.services.failure_diagnostics import DiagnosticFailure, classify_provider_error, record_failure
from app.services.transcription_adapter import TranscriptionProvider, TranscriptionServiceError
from app.services.transcription_assistance import POLICY_VERSION, validate_analysis
from app.services.transcription_assistance_adapter import TranscriptionAssistanceProvider
from app.services.transcription_settings import TranscriptionSettingsService
from app.services.turkish_text import canonical_form, has_unexpected_letter_script, normalized_words

ALLOWED_AUDIO_TYPES = {
    "audio/webm": ".webm",
    "audio/ogg": ".ogg",
    "audio/mp4": ".mp4",
    "audio/mpeg": ".mp3",
    "audio/wav": ".wav",
    "audio/x-wav": ".wav",
}


class TranscriptionExerciseNotFoundError(LookupError):
    pass


class UnsupportedAudioTypeError(ValueError):
    pass


class AudioTooLargeError(ValueError):
    pass


class EmptyAudioError(ValueError):
    pass


class TranscriptionService:
    def __init__(self, db: Session, provider: TranscriptionProvider, settings: Settings, user_id: str,
                 assistance_provider: TranscriptionAssistanceProvider) -> None:
        self.exercises = ExerciseRepository(db, user_id)
        self.provider = provider
        self.settings = settings
        self.db = db
        self.receipts = TranscriptionReceiptRepository(db, user_id)
        self.assistance_provider = assistance_provider

    def transcribe(self, *, exercise_id: str, audio: UploadFile, assistance_enabled: bool = False) -> TranscriptionResponse:
        exercise = self.exercises.get_owned(exercise_id)
        if exercise is None:
            raise TranscriptionExerciseNotFoundError(exercise_id)
        provider = self.provider
        selected_model = TranscriptionSettingsService(self.db, self.settings, self.exercises.user_id).selected()
        if selected_model:
            provider = provider.for_model(selected_model)
        if not provider.is_available:
            raise TranscriptionServiceError("transcription_not_configured")

        content_type = (audio.content_type or "").split(";", 1)[0].lower()
        extension = ALLOWED_AUDIO_TYPES.get(content_type)
        if extension is None:
            raise UnsupportedAudioTypeError(content_type)

        payload = audio.file.read(self.settings.max_audio_bytes + 1)
        if not payload:
            raise EmptyAudioError()
        if len(payload) > self.settings.max_audio_bytes:
            raise AudioTooLargeError()

        # Normal requests keep bytes in memory; authorized debug capture may retain them temporarily.
        try:
            result = provider.transcribe(
                audio=payload, filename=f"speech{extension}", content_type=content_type,
            )
        finally:
            del payload
            audio.file.close()
        if has_unexpected_letter_script(result.text) or result.review_required:
            # Preserve the original spelling for manual review; never run assistance or scoring.
            return TranscriptionResponse(text=result.text, review_required=True)
        raw = canonical_form(result.text)
        if not assistance_enabled:
            return TranscriptionResponse(text=raw)
        variants = list(exercise.target_hints_json.get("intended_tr_variants", []))
        canonical = exercise.target_hints_json.get("canonical_tr")
        if canonical:
            variants.append(str(canonical))
        # validate_analysis already discards proposals for these exact references.
        # Return the original transcript without an AI call or assistance receipt.
        normalized = normalized_words(raw)
        if normalized and normalized in {normalized_words(v) for v in variants}:
            return TranscriptionResponse(text=raw)
        if not self.assistance_provider.is_available:
            return TranscriptionResponse(text=raw, raw_text=raw, assistance_status="unavailable")
        try:
            analysis = TranscriptionAssistanceAnalysis.model_validate(self.assistance_provider.analyze(
                source_ru=exercise.source_ru, raw_text=raw,
                canonical_tr=canonical_form(str(canonical)) if canonical else None,
                intended_tr_variants=[canonical_form(v) for v in variants],
            ))
            changes = validate_analysis(raw, [canonical_form(v) for v in variants], analysis)
        except (AIServiceError, ValidationError, ValueError) as exc:
            record_failure(exc.failure if isinstance(exc, DiagnosticFailure) else classify_provider_error(exc))
            return TranscriptionResponse(text=raw, raw_text=raw, assistance_status="unavailable")
        receipt = self.receipts.add(exercise_id, raw, [c.model_dump() for c in changes], POLICY_VERSION)
        response = TranscriptionResponse(text=raw, raw_text=raw, transcription_id=receipt.id,
            policy_version=POLICY_VERSION, changes=changes, assistance_status="analyzed")
        self.db.commit()
        return response
