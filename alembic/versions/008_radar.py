"""radar — watched companies and postings, replacing job discovery monitors

Revision ID: 008
Revises: 007
Create Date: 2026-08-11
"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB, UUID

from alembic import op

revision: str = "008"
down_revision: str | None = "007"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # An unshipped browser-discovery branch also claimed revision 008 and created
    # `browser_sessions` (encrypted cookies). Anyone who ran it is stamped 008 with
    # that table present, so clean it up here rather than collide with it.
    op.execute("DROP TABLE IF EXISTS browser_sessions CASCADE")

    # Discovery monitors held only search candidates (URL + snippet), which Radar
    # replaces with real postings. Nothing worth migrating forward.
    op.execute("DROP INDEX IF EXISTS ix_job_discoveries_status")
    op.execute("DROP INDEX IF EXISTS ix_job_discoveries_next_run_at")
    op.execute("DROP INDEX IF EXISTS ix_job_discoveries_profile_id")
    op.execute("DROP TABLE IF EXISTS job_discoveries CASCADE")

    op.execute(
        """
        DO $$
        BEGIN
            IF EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_name = 'app_settings'
                  AND column_name = 'discovery_default_interval'
            ) THEN
                ALTER TABLE app_settings
                    RENAME COLUMN discovery_default_interval TO radar_poll_interval;
            END IF;
        END $$;
        """
    )
    op.execute("ALTER TABLE app_settings ALTER COLUMN radar_poll_interval SET DEFAULT 'daily'")

    op.create_table(
        "watched_companies",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "profile_id",
            UUID(as_uuid=True),
            sa.ForeignKey("profiles.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("ats_provider", sa.String(length=50), nullable=False),
        sa.Column("ats_token", sa.String(length=255), nullable=False),
        sa.Column("board_url", sa.String(length=2048), nullable=True),
        sa.Column("criteria", JSONB, nullable=True),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="active"),
        sa.Column("last_polled_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("polling_started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_error", sa.Text(), nullable=True),
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
        sa.UniqueConstraint(
            "profile_id",
            "ats_provider",
            "ats_token",
            name="uq_watched_companies_profile_board",
        ),
    )
    op.create_index("ix_watched_companies_profile_id", "watched_companies", ["profile_id"])
    op.create_index("ix_watched_companies_status", "watched_companies", ["status"])
    op.create_index("ix_watched_companies_last_polled_at", "watched_companies", ["last_polled_at"])

    op.create_table(
        "postings",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "watched_company_id",
            UUID(as_uuid=True),
            sa.ForeignKey("watched_companies.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "profile_id",
            UUID(as_uuid=True),
            sa.ForeignKey("profiles.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("external_id", sa.String(length=255), nullable=False),
        sa.Column("url", sa.String(length=2048), nullable=True),
        sa.Column("title", sa.String(length=500), nullable=False),
        sa.Column("location", sa.String(length=255), nullable=True),
        sa.Column("remote_flag", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("posted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("raw_payload", JSONB, nullable=True),
        sa.Column("screen_score", sa.Integer(), nullable=True),
        sa.Column("screen_reason", sa.Text(), nullable=True),
        sa.Column("state", sa.String(length=20), nullable=False, server_default="new"),
        sa.Column("job_id", UUID(as_uuid=True), sa.ForeignKey("jobs.id"), nullable=True),
        sa.Column(
            "first_seen_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "last_seen_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.UniqueConstraint(
            "watched_company_id",
            "external_id",
            name="uq_postings_company_external_id",
        ),
    )
    op.create_index("ix_postings_watched_company_id", "postings", ["watched_company_id"])
    op.create_index("ix_postings_profile_id", "postings", ["profile_id"])
    op.create_index("ix_postings_state", "postings", ["state"])


def downgrade() -> None:
    op.drop_index("ix_postings_state", table_name="postings")
    op.drop_index("ix_postings_profile_id", table_name="postings")
    op.drop_index("ix_postings_watched_company_id", table_name="postings")
    op.drop_table("postings")

    op.drop_index("ix_watched_companies_last_polled_at", table_name="watched_companies")
    op.drop_index("ix_watched_companies_status", table_name="watched_companies")
    op.drop_index("ix_watched_companies_profile_id", table_name="watched_companies")
    op.drop_table("watched_companies")

    op.alter_column(
        "app_settings",
        "radar_poll_interval",
        new_column_name="discovery_default_interval",
        server_default="weekly",
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
