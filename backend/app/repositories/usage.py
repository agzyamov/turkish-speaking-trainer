from datetime import datetime

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import AIUsageEvent


class UsageRepository:
    """Reads and writes the AI usage ledger."""

    def __init__(self, db: Session) -> None:
        self.db = db

    def spent_micro_usd(self, start: datetime, end: datetime, *, user_id: str | None = None) -> int:
        query = select(func.coalesce(func.sum(AIUsageEvent.cost_micro_usd), 0)).where(
            AIUsageEvent.created_at >= start, AIUsageEvent.created_at < end)
        if user_id is not None:
            query = query.where(AIUsageEvent.user_id == user_id)
        return int(self.db.scalar(query) or 0)

    def add(self, event: AIUsageEvent) -> None:
        self.db.add(event)
