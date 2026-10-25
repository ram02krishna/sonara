.PHONY: help dev build lint test docker-up docker-down docker-logs docker-build migrate-up migrate-down gen-spec

help:
	@echo "Sonara - Music Streaming Monorepo"
	@echo ""
	@echo "Commands:"
	@echo "  make dev          - Run both frontend and backend concurrently in dev mode"
	@echo "  make dev-web      - Run Next.js frontend dev server"
	@echo "  make dev-api      - Run Go backend API server"
	@echo "  make build        - Build all services (web & api)"
	@echo "  make lint         - Run linters across workspace"
	@echo "  make test         - Run frontend and backend tests"
	@echo "  make docker-up    - Spin up full stack (web, api, postgres, redis) via Docker Compose"
	@echo "  make docker-down  - Stop all Docker Compose containers"
	@echo "  make docker-logs  - Stream Docker Compose logs"
	@echo "  make docker-build - Build the API and web Docker images (checks the Dockerfiles before you push)"
	@echo "  make migrate-up   - Apply database migrations"
	@echo "  make migrate-down - Rollback database migrations"
	@echo "  make gen-spec     - Generate TypeScript & Go code from OpenAPI spec"

dev-web:
	npm run dev --workspace=apps/web

dev-api:
	cd apps/api && go run ./cmd/server

dev:
	@echo "Starting Sonara services..."
	docker compose -f infra/docker-compose.yml up -d postgres redis
	@echo "Postgres and Redis are up. Run 'make dev-api' and 'make dev-web' in separate terminals."

build:
	npm run build --workspace=apps/web
	cd apps/api && go build -o bin/server ./cmd/server

lint:
	npm run lint --workspace=apps/web
	cd apps/api && go vet ./...

test:
	npm run test --workspace=apps/web --if-present
	cd apps/api && go test -v -race ./...

docker-up:
	docker compose -f infra/docker-compose.yml up --build -d

docker-down:
	docker compose -f infra/docker-compose.yml down

docker-logs:
	docker compose -f infra/docker-compose.yml logs -f

docker-build:
	docker build -f infra/Dockerfile.api -t sonara-api:local .
	docker build -f infra/Dockerfile.web -t sonara-web:local .

gen-spec:
	npm run gen --workspace=packages/api-spec
