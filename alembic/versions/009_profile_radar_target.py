"""profile radar target — what Radar should surface for this person

Revision ID: 009
Revises: 008
Create Date: 2026-08-11
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "009"
down_revision: str | None = "008"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("profiles", sa.Column("radar_target", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("profiles", "radar_target")
