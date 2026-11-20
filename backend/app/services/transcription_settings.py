from sqlalchemy.orm import Session

from app.config import Settings
from app.repositories.model_debug import ModelDebugRepository
from app.repositories.users import UserRepository
from app.schemas.transcription_settings import TranscriptionModelSettings
from app.services.model_debug import can_debug


class TranscriptionSettingsService:
    def __init__(self, db: Session, settings: Settings, user_id: str):
        self.db, self.settings, self.user_id = db, settings, user_id
        self.repository = ModelDebugRepository(db, user_id)
        self.users = UserRepository(db)

    def options(self) -> list[str]:
        models = list(self.settings.elevenlabs_stt_models)
        if self.settings.elevenlabs_stt_model and self.settings.elevenlabs_stt_model not in models:
            models.append(self.settings.elevenlabs_stt_model)
        return models

    def selected(self) -> str | None:
        user = self.users.get(self.user_id)
        if user is None or not can_debug(user, self.settings):
            return None
        setting = self.repository.setting()
        selected = setting.transcription_model if setting else None
        return selected if selected in self.options() else None

    def read(self) -> TranscriptionModelSettings:
        selected = self.selected()
        return TranscriptionModelSettings(selected_model=selected,
            effective_model=selected or self.settings.elevenlabs_stt_model,
            default_model=self.settings.elevenlabs_stt_model, options=self.options())

    def change(self, model: str | None) -> TranscriptionModelSettings:
        if model is not None and model not in self.options():
            raise ValueError("Unknown transcription model")
        self.repository.select_transcription_model(model)
        self.db.commit()
        return self.read()
