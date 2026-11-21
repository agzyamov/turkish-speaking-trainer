"""ai_usage_events ledger for the monthly spend cap

Revision ID: a71c0de5b2f1
Revises: f0e065fafe11
Create Date: 2026-11-20 11:00:00
"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "a71c0de5b2f1"
down_revision: str | None = "f0e065fafe11"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "ai_usage_events",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("user_id", sa.String(36), nullable=True),
        sa.Column("purpose", sa.String(100), nullable=False),
        sa.Column("provider", sa.String(50), nullable=False),
        sa.Column("model", sa.String(200), nullable=False),
        sa.Column("input_tokens", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("output_tokens", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("cache_write_tokens", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("cache_read_tokens", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("stt_ms", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("cost_micro_usd", sa.BigInteger(), nullable=False),
        sa.Column("estimated", sa.Boolean(), nullable=False, server_default=sa.false()),
    )
    op.create_index("ix_ai_usage_events_created_at", "ai_usage_events", ["created_at"])


def downgrade() -> None:
    op.drop_index("ix_ai_usage_events_created_at", table_name="ai_usage_events")
    op.drop_table("ai_usage_events")
