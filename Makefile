SHELL := /bin/bash
.DEFAULT_GOAL := help


COMPOSE := docker compose -f infra/docker-compose.yml -f infra/docker-compose.override.yml --env-file .env

API_DIR := apps/api
WEB_DIR := apps/web

.PHONY: help
help: ## Show available targets
	@grep -E '^[a-zA-Z_-]+:.*?## ' $(MAKEFILE_LIST) | \
		awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-18s\033[0m %s\n", $$1, $$2}'



.PHONY: env
env: ## Create .env from .env.example if missing
	@if [ ! -f .env ]; then \
		cp .env.example .env; \
		echo ".env created from .env.example. Edit secrets before staging."; \
	else \
		echo ".env already exists. Skipped."; \
	fi

.PHONY: install
install: install-api install-web ## Install local toolchains (venv + node_modules)

.PHONY: install-api
install-api:
	cd $(API_DIR) && python3 -m venv .venv && \
		.venv/bin/pip install -U pip && \
		.venv/bin/pip install -r requirements-dev.txt

.PHONY: install-web
install-web:
	cd $(WEB_DIR) && npm install



.PHONY: up
up: env ## Start the full stack (build images if needed)
	$(COMPOSE) up -d --build

.PHONY: down
down: ## Stop the stack (keep volumes)
	$(COMPOSE) down --remove-orphans

.PHONY: down-volumes
down-volumes: ## Stop the stack AND wipe volumes (destructive)
	$(COMPOSE) down -v --remove-orphans

.PHONY: logs
logs: ## Tail logs from all services
	$(COMPOSE) logs -f --tail=200

.PHONY: ps
ps: ## Show service status
	$(COMPOSE) ps



.PHONY: migrate
migrate: ## Apply Alembic migrations inside the api container
	$(COMPOSE) exec api alembic upgrade head

.PHONY: revision
revision: ## Create a new Alembic revision. Usage: make revision m="add students table"
	@if [ -z "$(m)" ]; then echo "Usage: make revision m=\"message\""; exit 1; fi
	$(COMPOSE) exec api alembic revision --autogenerate -m "$(m)"

.PHONY: psql
psql: ## Open a psql shell on the running postgres container
	$(COMPOSE) exec postgres psql -U $${POSTGRES_USER:-eduadvisor} -d $${POSTGRES_DB:-eduadvisor}


# Test & lint 


.PHONY: test
test: test-api test-web ## Run all unit tests

.PHONY: test-api
test-api:
	cd $(API_DIR) && .venv/bin/pytest

.PHONY: test-web
test-web:
	cd $(WEB_DIR) && npm test

.PHONY: lint
lint: lint-api lint-web ## Lint everything

.PHONY: lint-api
lint-api:
	cd $(API_DIR) && .venv/bin/ruff check . && .venv/bin/ruff format --check .

.PHONY: lint-web
lint-web:
	cd $(WEB_DIR) && npm run lint && npm run typecheck

.PHONY: format
format: ## Auto-format code (api only; web uses next lint --fix manually)
	cd $(API_DIR) && .venv/bin/ruff format . && .venv/bin/ruff check --fix .
