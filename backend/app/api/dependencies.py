from time import perf_counter

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.config import Settings, get_settings
from app.db import get_db
from app.models import User
from app.services.auth_service import AuthenticationUnavailableError, SupabaseAuthService, UserService

bearer_scheme = HTTPBearer(auto_error=False)


def get_current_user(
    request: Request,
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> User:
    if credentials is None or credentials.scheme.casefold() != "bearer":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required")
    try:
        auth_started = perf_counter()
        identity = SupabaseAuthService(settings).authenticate(credentials.credentials)
        request.state.auth_ms = (perf_counter() - auth_started) * 1000
        sync_started = perf_counter()
        user = UserService(db, settings).sync(identity)
        request.state.user_sync_ms = (perf_counter() - sync_started) * 1000
        return user
    except PermissionError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid authentication") from exc
    except AuthenticationUnavailableError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Authentication unavailable") from exc


def require_admin(user: User = Depends(get_current_user)) -> User:
    if user.role != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Administrator access required")
    return user


def require_debug_admin(user: User = Depends(get_current_user), settings: Settings = Depends(get_settings)) -> User:
    from app.services.model_debug import can_debug
    if not can_debug(user, settings):
        raise HTTPException(status_code=403, detail="Debug administrator access required")
    return user


async def ai_usage_context(user: User = Depends(get_current_user), db: Session = Depends(get_db),
                           settings: Settings = Depends(get_settings)):
    """Tells the budget guard who is spending and where the ledger lives for this request."""
    from app.services.ai_usage import MICRO
    from app.services.budget_guard import UsageContext, usage_context
    if user.role == "admin":
        daily_limit = None
    else:
        usd = settings.ai_premium_user_daily_budget_usd if user.access_tier == "premium" else settings.ai_free_user_daily_budget_usd
        daily_limit = int(usd * MICRO)
    token = usage_context.set(UsageContext(user.id, db.get_bind(), daily_limit))
    try:
        yield
    finally:
        usage_context.reset(token)


async def model_debug_context(user: User = Depends(get_current_user), db: Session = Depends(get_db),
                              settings: Settings = Depends(get_settings)):
    from app.services.model_debug import DebugContext, can_debug, debug_context
    token = debug_context.set(DebugContext(user.id, db.get_bind()) if can_debug(user, settings) else None)
    try:
        yield
    finally:
        debug_context.reset(token)
