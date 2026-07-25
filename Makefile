.PHONY: help infra-up infra-down infra-status frontend-install frontend-run backend-run api-lint test check

help:
	@echo "make infra-up        PostgreSQL과 Redis 시작"
	@echo "make infra-down      PostgreSQL과 Redis 중지"
	@echo "make frontend-run    프론트 개발 서버 시작"
	@echo "make backend-run     백엔드 개발 서버 시작"
	@echo "make api-lint        OpenAPI 계약 검사"
	@echo "make test            프론트와 백엔드 테스트"
	@echo "make check           push 전 전체 검사"

infra-up:
	docker compose up -d
	docker compose ps

infra-down:
	docker compose down

infra-status:
	docker compose ps

frontend-install:
	cd frontend && npm ci

frontend-run:
	cd frontend && npm run dev

backend-run:
	cd backend && set -a && . ./.env && set +a && ./gradlew bootRun

api-lint:
	npx --yes @redocly/cli lint docs/openapi.yaml --config .redocly.yaml

test:
	cd frontend && npm run test
	cd backend && ./gradlew test

check:
	./scripts/check-all.sh
