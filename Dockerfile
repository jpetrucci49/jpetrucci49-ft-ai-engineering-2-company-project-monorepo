# Public demo image for a Hugging Face Docker Space (port 7860).
# Local `docker compose` does not use this file. It builds services/Dockerfile and uis/Dockerfile.
FROM python:3.12-slim-bookworm

COPY --from=ghcr.io/astral-sh/uv:0.12.1 /uv /usr/local/bin/uv

WORKDIR /opt/healthcore

ENV UV_SYSTEM_PYTHON=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    HEALTHCORE_REPO_ROOT=/opt/healthcore \
    PYTHONPATH=/opt/healthcore:/opt/healthcore/services/api \
    HEALTHCORE_DEMO=1 \
    SUPABASE_DATABASE_URL=sqlite:///./inventory.db

COPY deploy/demo/requirements.txt /tmp/requirements.txt
RUN uv pip install --system -r /tmp/requirements.txt

COPY services/api /opt/healthcore/services/api
COPY data /opt/healthcore/data
COPY docs/company-knowledge-base /opt/healthcore/docs/company-knowledge-base
COPY mcps /opt/healthcore/mcps
COPY scripts /opt/healthcore/scripts

RUN useradd --create-home --uid 10001 --shell /usr/sbin/nologin app \
    && chown -R app:app /opt/healthcore
USER app

WORKDIR /opt/healthcore/services/api
EXPOSE 7860

CMD ["python", "/opt/healthcore/scripts/demo_boot.py"]
