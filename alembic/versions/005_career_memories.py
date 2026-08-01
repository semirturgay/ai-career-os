"""career memory snippets from user feedback

Revision ID: 005
Revises: 004
Create Date: 2026-08-01
"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "005"
down_revision: str | None = "004"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "career_memories",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("profile_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("category", sa.String(length=50), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("memory_key", sa.String(length=255), nullable=True),
        sa.Column("source_feedback_ids", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
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
        sa.ForeignKeyConstraint(["profile_id"], ["profiles.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_career_memories_profile_id", "career_memories", ["profile_id"])
    op.create_index(
        "ix_career_memories_profile_active",
        "career_memories",
        ["profile_id", "active"],
    )
    op.create_index(
        "ix_career_memories_profile_memory_key",
        "career_memories",
        ["profile_id", "memory_key"],
    )


def downgrade() -> None:
    op.drop_index("ix_career_memories_profile_memory_key", table_name="career_memories")
    op.drop_index("ix_career_memories_profile_active", table_name="career_memories")
    op.drop_index("ix_career_memories_profile_id", table_name="career_memories")
    op.drop_table("career_memories")
