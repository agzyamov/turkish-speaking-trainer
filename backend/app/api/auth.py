from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user, require_admin
from app.config import Settings, get_settings
from app.db import get_db
from app.models import User
from app.schemas import AdminUserResponse, CurrentUserResponse
from app.schemas.ai_usage import AdminUsageResponse
from app.schemas.auth import AndroidPremiumClaim, ReviewLoginRequest, ReviewLoginResponse, UserPreferences
from app.services.ai_usage import MICRO
from app.services.auth_service import AuthenticationUnavailableError, UserService
from app.services.budget_guard import BudgetGuard
from app.services.review_login import ReviewLoginRateLimitError, ReviewLoginService

router = APIRouter(tags=["users"])


@router.post("/auth/review-login", response_model=ReviewLoginResponse)
def review_login(payload: ReviewLoginRequest, response: Response, settings: Settings = Depends(get_settings)) -> ReviewLoginResponse:
    response.headers["Cache-Control"] = "no-store"
    try:
        return ReviewLoginService(settings).sign_in(payload.username, payload.password.get_secret_value())
    except PermissionError:
        raise HTTPException(401, "Review sign-in failed", headers={"Cache-Control": "no-store"}) from None
    except ReviewLoginRateLimitError:
        raise HTTPException(429, "Try again later", headers={"Cache-Control": "no-store", "Retry-After": "60"}) from None
    except AuthenticationUnavailableError:
        raise HTTPException(503, "Review sign-in is unavailable", headers={"Cache-Control": "no-store"}) from None


@router.get("/auth/me", response_model=CurrentUserResponse)
def current_user(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> CurrentUserResponse:
    return UserService(db).current_response(user)


@router.get("/admin/users", response_model=list[AdminUserResponse])
def list_users(
    _admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> list[AdminUserResponse]:
    return UserService(db).list_users()


@router.get("/admin/usage", response_model=AdminUsageResponse)
def ai_usage(
    _admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> AdminUsageResponse:
    status = BudgetGuard(settings, engine=db.get_bind()).status()
    return AdminUsageResponse(
        month_start=status.month_start,
        budget_usd=status.budget_micro_usd / MICRO,
        spent_usd=status.spent_micro_usd / MICRO,
        remaining_usd=status.remaining_micro_usd / MICRO,
    )


@router.post("/auth/me/android-premium", response_model=CurrentUserResponse)
def claim_android_premium(
    payload: AndroidPremiumClaim,
    response: Response,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> CurrentUserResponse:
    response.headers["Cache-Control"] = "no-store"
    service = UserService(db)
    return service.current_response(service.grant_android_premium(user))


@router.get("/auth/me/preferences", response_model=UserPreferences)
def preferences(user: User = Depends(get_current_user)) -> UserPreferences:
    return UserPreferences(assistance_enabled=user.assistance_enabled)


@router.patch("/auth/me/preferences", response_model=UserPreferences)
def update_preferences(
    payload: UserPreferences,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> UserPreferences:
    UserService(db).update_preferences(user, payload.assistance_enabled)
    return payload
