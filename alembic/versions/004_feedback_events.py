"""feedback events for career memory

Revision ID: 004
Revises: 003
Create Date: 2026-08-01
"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "004"
down_revision: str | None = "003"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "feedback_events",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("profile_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("job_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("match_analysis_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("event_type", sa.String(length=50), nullable=False),
        sa.Column("payload", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["profile_id"], ["profiles.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["job_id"], ["jobs.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["match_analysis_id"], ["match_analyses.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_feedback_events_profile_id", "feedback_events", ["profile_id"])
    op.create_index("ix_feedback_events_job_id", "feedback_events", ["job_id"])
    op.create_index(
        "ix_feedback_events_profile_created_at",
        "feedback_events",
        ["profile_id", "created_at"],
    )


def downgrade() -> None:
    op.drop_index("ix_feedback_events_profile_created_at", table_name="feedback_events")
    op.drop_index("ix_feedback_events_job_id", table_name="feedback_events")
    op.drop_index("ix_feedback_events_profile_id", table_name="feedback_events")
    op.drop_table("feedback_events")
