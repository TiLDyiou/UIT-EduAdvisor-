"""Session-scoped Docker containers for integration tests."""

from __future__ import annotations

import os
import subprocess
import sys
import time
import urllib.request
from collections.abc import Iterator
from pathlib import Path

import pytest
import pytest_asyncio
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

API_ROOT = Path(__file__).resolve().parents[1]


def _postgres_async_url(host: str, port: int, user: str, password: str, db: str) -> str:
    from urllib.parse import quote_plus

    return f"postgresql+asyncpg://{quote_plus(user)}:{quote_plus(password)}@{host}:{port}/{db}"


def _run_alembic_upgrade(postgres) -> None:
    host = postgres.get_container_host_ip()
    port = postgres.get_exposed_port(5432)
    env = os.environ.copy()
    env["POSTGRES_HOST"] = host
    env["POSTGRES_PORT"] = str(port)
    env["POSTGRES_USER"] = postgres.username
    env["POSTGRES_PASSWORD"] = postgres.password
    env["POSTGRES_DB"] = postgres.dbname
    env["PYTHONPATH"] = str(API_ROOT)
    subprocess.run(
        [sys.executable, "-m", "alembic", "upgrade", "head"],
        cwd=str(API_ROOT),
        env=env,
        check=True,
    )


@pytest.fixture(scope="session")
def postgres_container() -> Iterator:
    from testcontainers.postgres import PostgresContainer

    with PostgresContainer("pgvector/pgvector:pg16") as pg:
        _run_alembic_upgrade(pg)
        yield pg


@pytest.fixture(scope="session")
def vault_container() -> Iterator:
    from testcontainers.core.container import DockerContainer

    vault = (
        DockerContainer("hashicorp/vault:1.18")
        .with_exposed_ports(8200)
        .with_env("VAULT_DEV_ROOT_TOKEN_ID", "test-root-token")
        .with_env("VAULT_DEV_LISTEN_ADDRESS", "0.0.0.0:8200")
        .with_kwargs(cap_add=["IPC_LOCK"])
        .with_command(["server", "-dev"])
    )
    vault.start()
    try:
        host = vault.get_container_host_ip()
        port = vault.get_exposed_port(8200)
        base = f"http://{host}:{port}"
        deadline = time.monotonic() + 120.0
        while time.monotonic() < deadline:
            try:
                urllib.request.urlopen(base + "/v1/sys/health", timeout=2)
                break
            except Exception:
                time.sleep(0.25)
        else:
            raise RuntimeError("Vault did not become reachable in time")
        yield vault
    finally:
        vault.stop()


@pytest.fixture(scope="session")
def redis_container() -> Iterator:
    from testcontainers.redis import RedisContainer

    with RedisContainer("redis:7-alpine") as r:
        yield r


_TRUNCATE_SQL = """
TRUNCATE TABLE
    reminder_preferences,
    link_tokens,
    bot_accounts,
    pinned_messages,
    chat_summaries,
    term_course_sections,
    term_course_offerings,
    term_exam_schedules,
    tooltip_terms,
    course_resources,
    policy_chunks,
    policy_documents,
    elective_group_courses,
    elective_groups,
    curriculum_courses,
    curriculum_terms,
    curricula,
    deadlines,
    exams,
    schedules,
    grades,
    enrollments,
    course_prerequisites,
    courses,
    admin_jobs,
    sync_jobs,
    student_credentials,
    consent_records,
    audit_logs,
    students,
    admin_users,
    majors
RESTART IDENTITY CASCADE;
"""


@pytest_asyncio.fixture
async def database_engine(postgres_container):
    """Function-scoped engine so connections stay on the same event loop as each test."""
    host = postgres_container.get_container_host_ip()
    port = postgres_container.get_exposed_port(5432)
    url = _postgres_async_url(
        host,
        port,
        postgres_container.username,
        postgres_container.password,
        postgres_container.dbname,
    )
    engine = create_async_engine(url, pool_pre_ping=True)
    yield engine
    await engine.dispose()


@pytest_asyncio.fixture
async def db_session(database_engine) -> AsyncSession:
    maker = async_sessionmaker(database_engine, expire_on_commit=False)
    async with maker() as session:
        await session.execute(text(_TRUNCATE_SQL))
        await session.execute(
            text(
                """
                INSERT INTO majors (code, name)
                SELECT 'UNKNOWN', 'Chưa xác định'
                WHERE NOT EXISTS (SELECT 1 FROM majors WHERE code = 'UNKNOWN');
                """
            )
        )
        await session.commit()
        yield session
        await session.rollback()


@pytest.fixture(scope="session")
def vault_http_url(vault_container) -> str:
    host = vault_container.get_container_host_ip()
    port = vault_container.get_exposed_port(8200)
    return f"http://{host}:{port}"


@pytest.fixture(scope="session")
def vault_hvac_client(vault_http_url: str):
    import hvac

    return hvac.Client(url=vault_http_url, token="test-root-token")


@pytest_asyncio.fixture
async def vault_transit(vault_hvac_client):
    from app.core.security.vault_transit import VaultTransit

    vt = VaultTransit(vault_hvac_client)
    await vt.bootstrap()
    return vt


@pytest_asyncio.fixture
async def redis_async_client(redis_container):
    import redis.asyncio as redis_async

    host = redis_container.get_container_host_ip()
    port = redis_container.get_exposed_port(6379)
    url = f"redis://{host}:{port}/0"
    client = redis_async.from_url(url, decode_responses=True)
    yield client
    await client.aclose()
