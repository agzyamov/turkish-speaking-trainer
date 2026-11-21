from datetime import datetime

from pydantic import BaseModel, Field


class ModelPrice(BaseModel):
    """USD prices for one model, read from configuration. Token prices are per million tokens."""
    input_per_mtok: float = Field(default=0, ge=0)
    output_per_mtok: float = Field(default=0, ge=0)
    cache_write_per_mtok: float | None = Field(default=None, ge=0)
    cache_read_per_mtok: float | None = Field(default=None, ge=0)
    audio_per_minute: float = Field(default=0, ge=0)


class AdminUsageResponse(BaseModel):
    """Month-to-date AI spend for the admin view."""
    month_start: datetime
    budget_usd: float
    spent_usd: float
    remaining_usd: float
