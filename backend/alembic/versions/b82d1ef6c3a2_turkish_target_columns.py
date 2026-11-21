"""rename Serbian-suffixed columns to Turkish-suffixed ones (ADR-0004)

Revision ID: b82d1ef6c3a2
Revises: a71c0de5b2f1
Create Date: 2026-11-20 12:00:00
"""
from collections.abc import Sequence

from alembic import op

revision: str = "b82d1ef6c3a2"
down_revision: str | None = "a71c0de5b2f1"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

RENAMES = (
    ("attempts", "transcript_sr", "transcript_tr"),
    ("topic_phrases", "canonical_sr", "canonical_tr"),
    ("review_phrases", "intended_sr_variants_json", "intended_tr_variants_json"),
    ("word_learning_items", "translation_sr", "translation_tr"),
)


# An in-place rename. Rebuilding the table (Alembic batch mode) would drop it, and on SQLite
# with foreign keys on that cascades deletes to attempt_requests and error_events.
def upgrade() -> None:
    for table, old, new in RENAMES:
        op.execute(f'ALTER TABLE {table} RENAME COLUMN {old} TO {new}')


def downgrade() -> None:
    for table, old, new in reversed(RENAMES):
        op.execute(f'ALTER TABLE {table} RENAME COLUMN {new} TO {old}')
