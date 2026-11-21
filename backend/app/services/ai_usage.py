"""Measured usage of AI providers and its conversion to money.

Adapters describe what a call consumed as a ``Usage``. Prices come from
configuration (``AI_PRICE_TABLE``); none is written into code.
"""
from __future__ import annotations

from dataclasses import dataclass

from app.schemas.ai_usage import ModelPrice

MICRO = 1_000_000


class PriceUnknownError(Exception):
    """No price is configured for the model in use, so spend cannot be measured."""


@dataclass(frozen=True)
class Usage:
    provider: str
    model: str
    input_tokens: int = 0
    output_tokens: int = 0
    cache_write_tokens: int = 0
    cache_read_tokens: int = 0
    stt_ms: int = 0


def price_for(prices: dict[str, ModelPrice], model: str) -> ModelPrice:
    try:
        return prices[model]
    except KeyError as exc:
        raise PriceUnknownError(model) from exc


def cost_micro_usd(usage: Usage, prices: dict[str, ModelPrice]) -> int:
    """Cost of one call in millionths of a dollar, rounded up so spend is never under-counted."""
    price = price_for(prices, usage.model)
    cache_write = price.input_per_mtok if price.cache_write_per_mtok is None else price.cache_write_per_mtok
    cache_read = price.input_per_mtok if price.cache_read_per_mtok is None else price.cache_read_per_mtok
    # A price per million tokens equals micro-dollars per token.
    exact = (
        usage.input_tokens * price.input_per_mtok
        + usage.output_tokens * price.output_per_mtok
        + usage.cache_write_tokens * cache_write
        + usage.cache_read_tokens * cache_read
        + usage.stt_ms / 60_000 * price.audio_per_minute * MICRO
    )
    return int(-(-exact // 1))


def worst_case_text_micro_usd(prices: dict[str, ModelPrice], model: str, *, max_input_tokens: int, max_output_tokens: int) -> int:
    price = price_for(prices, model)
    # Cache writes can cost more than plain input; assume the dearer of the two.
    input_price = max(price.input_per_mtok, price.cache_write_per_mtok or 0)
    return int(-(-(max_input_tokens * input_price + max_output_tokens * price.output_per_mtok) // 1))


def worst_case_audio_micro_usd(prices: dict[str, ModelPrice], model: str, *, max_seconds: float) -> int:
    price = price_for(prices, model)
    return int(-(-(max_seconds / 60 * price.audio_per_minute * MICRO) // 1))
