"""payment country: serbia becomes turkey (Phase 5 rebrand)

Revision ID: c93e0f1a2b47
Revises: b82d1ef6c3a2
Create Date: 2026-11-21 10:30:00
"""
from collections.abc import Sequence

from alembic import op

revision: str = "c93e0f1a2b47"
down_revision: str | None = "b82d1ef6c3a2"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

# payment_requests has no incoming foreign keys, so the SQLite batch rebuild cannot cascade anywhere.
CONSTRAINT = "ck_payment_country"


def _swap(old: str, new: str) -> None:
    with op.batch_alter_table("payment_requests") as batch:
        batch.drop_constraint(CONSTRAINT, type_="check")
    op.execute(f"UPDATE payment_requests SET country = '{new}' WHERE country = '{old}'")
    with op.batch_alter_table("payment_requests") as batch:
        batch.create_check_constraint(CONSTRAINT, f"country IN ('russia','{new}','other')")


def upgrade() -> None:
    _swap("serbia", "turkey")


def downgrade() -> None:
    _swap("turkey", "serbia")
