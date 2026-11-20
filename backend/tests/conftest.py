import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user
from app.db.base import Base
from app.db.seed import seed_catalog
from app.db.session import create_database_engine, get_db
from app.main import app
from app.models import User
from app.services.ai_adapter import get_ai_provider
from app.services.auth_service import LEGACY_USER_ID
from app.services.transcription_adapter import get_transcription_provider
from app.services.transcription_assistance_adapter import get_transcription_assistance_provider
from tests.fakes import FakeAIProvider, FakeTranscriptionAssistanceProvider, FakeTranscriptionProvider


@pytest.fixture(autouse=True)
def synthetic_administrator(monkeypatch):
    # The application has no built-in administrators; tests name a synthetic one.
    from app.config import get_settings
    monkeypatch.setenv("ADMIN_EMAILS", "owner@example.com")
    monkeypatch.setenv("DEBUG_ADMIN_EMAIL", "owner@example.com")
    get_settings.cache_clear()
    yield
    get_settings.cache_clear()


@pytest.fixture(autouse=True)
def no_live_telegram(monkeypatch):
    # Local credentials must never turn automated tests into real notifications.
    monkeypatch.setattr("app.services.notifications.send_notification", lambda *_args: True)


@pytest.fixture
def db_session() -> Session:
    engine = create_database_engine("sqlite+pysqlite:///:memory:")
    Base.metadata.create_all(engine)
    with Session(engine) as session:
        session.add(User(
            id=LEGACY_USER_ID,
            email="learner@example.com",
            display_name="Test learner",
            role="user",
            access_tier="free",
        ))
        session.commit()
        yield session
        session.rollback()
    engine.dispose()


@pytest.fixture
def api_client(db_session: Session) -> TestClient:
    user = db_session.get(User, LEGACY_USER_ID)
    assert user is not None
    seed_catalog(db_session)
    db_session.commit()
    offline_ai = FakeAIProvider()

    def override_db():
        yield db_session

    app.dependency_overrides[get_db] = override_db
    app.dependency_overrides[get_ai_provider] = lambda: offline_ai
    app.dependency_overrides[get_transcription_provider] = lambda: FakeTranscriptionProvider(available=False)
    app.dependency_overrides[get_transcription_assistance_provider] = lambda: FakeTranscriptionAssistanceProvider()
    app.dependency_overrides[get_current_user] = lambda: user
    with TestClient(app) as client:
        yield client
    app.dependency_overrides.clear()
