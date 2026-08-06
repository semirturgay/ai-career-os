"""job discovery monitors

Revision ID: 007
Revises: 006
Create Date: 2026-08-06
"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB, UUID

from alembic import op

revision: str = "007"
down_revision: str | None = "006"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "app_settings",
        sa.Column(
            "discovery_default_interval",
            sa.String(length=20),
            nullable=False,
            server_default="weekly",
        ),
    )

    op.create_table(
        "job_discoveries",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("profile_id", UUID(as_uuid=True), sa.ForeignKey("profiles.id"), nullable=False),
        sa.Column("criteria", JSONB, nullable=False),
        sa.Column("interval", sa.String(length=20), nullable=False, server_default="default"),
        sa.Column("enabled", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="pending"),
        sa.Column("candidates", JSONB, nullable=False, server_default=sa.text("'[]'::jsonb")),
        sa.Column("error", sa.Text(), nullable=True),
        sa.Column("last_run_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("next_run_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_viewed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
    )
    op.create_index("ix_job_discoveries_profile_id", "job_discoveries", ["profile_id"])
    op.create_index("ix_job_discoveries_next_run_at", "job_discoveries", ["next_run_at"])
    op.create_index("ix_job_discoveries_status", "job_discoveries", ["status"])


def downgrade() -> None:
    op.drop_index("ix_job_discoveries_status", table_name="job_discoveries")
    op.drop_index("ix_job_discoveries_next_run_at", table_name="job_discoveries")
    op.drop_index("ix_job_discoveries_profile_id", table_name="job_discoveries")
    op.drop_table("job_discoveries")
    op.drop_column("app_settings", "discovery_default_interval")
