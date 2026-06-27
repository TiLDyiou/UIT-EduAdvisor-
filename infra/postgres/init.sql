-- init.sql: runs ONCE when the postgres data volume is first created.
--
-- Note: pgvector is also created idempotently inside Alembic migration 0001
-- so a freshly cloned dev environment without docker-compose still works.
-- Putting it here too means psql shells and CLI tools see the extension
-- immediately, even before any migration has run.
CREATE EXTENSION IF NOT EXISTS vector;
