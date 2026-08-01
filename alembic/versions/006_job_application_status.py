"""promote application status onto jobs

Revision ID: 006
Revises: 005
Create Date: 2026-08-01
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "006"
down_revision: str | None = "005"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "jobs",
        sa.Column(
            "application_status",
            sa.String(length=50),
            nullable=False,
            server_default="saved",
        ),
    )
    op.create_index("ix_jobs_application_status", "jobs", ["application_status"])

    op.execute(
        """
        UPDATE jobs AS j
        SET application_status = latest.status
        FROM (
            SELECT DISTINCT ON (job_id)
                job_id,
                payload->>'status' AS status
            FROM feedback_events
            WHERE event_type = 'application_outcome'
              AND job_id IS NOT NULL
              AND payload ? 'status'
            ORDER BY job_id, created_at DESC
        ) AS latest
        WHERE j.id = latest.job_id
          AND latest.status IS NOT NULL
        """
    )


def downgrade() -> None:
    op.drop_index("ix_jobs_application_status", table_name="jobs")
    op.drop_column("jobs", "application_status")
