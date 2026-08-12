FROM python:3.12-slim

COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends fonts-dejavu-core \
    && rm -rf /var/lib/apt/lists/*

ENV UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy

# The local document classifier needs torch: 722MB image without it, 1.89GB with. It is
# a pre-capture filter that fails open, so it is opt-in:
#   docker build --build-arg INCLUDE_CLASSIFIER=true .
ARG INCLUDE_CLASSIFIER=false

COPY pyproject.toml uv.lock ./
# The cache mount keeps uv's downloads out of the layer — they were adding ~300MB of
# wheels to the image on top of the venv they were used to build — while still making
# rebuilds fast.
RUN --mount=type=cache,target=/root/.cache/uv \
    if [ "$INCLUDE_CLASSIFIER" = "true" ]; then \
      uv sync --frozen --no-dev --no-install-project --extra classifier; \
    else \
      uv sync --frozen --no-dev --no-install-project; \
    fi

COPY app ./app
COPY alembic ./alembic
COPY alembic.ini .
COPY scripts/docker-entrypoint.sh ./scripts/docker-entrypoint.sh
RUN chmod +x ./scripts/docker-entrypoint.sh

ENV PATH="/app/.venv/bin:$PATH"

EXPOSE 8000

ENTRYPOINT ["./scripts/docker-entrypoint.sh"]
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]
