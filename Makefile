.PHONY: setup mongo backend frontend seed import install dev

PYTHON ?= python3
VENV := backend/.venv
API_PORT ?= 45211
WEB_PORT ?= 45211

setup:
	$(PYTHON) -m venv $(VENV)
	$(VENV)/bin/pip install -r backend/requirements.txt
	[ -f backend/.env ] || cp backend/.env.example backend/.env
	[ -f frontend/.env ] || cp frontend/.env.example frontend/.env
	cd frontend && yarn install

mongo:
	mkdir -p /tmp/mongodb-data
	mongod --dbpath /tmp/mongodb-data --bind_ip 127.0.0.1 --port 27017 --fork --logpath /tmp/mongod.log || true

backend:
	$(VENV)/bin/uvicorn server:app --app-dir backend --host 0.0.0.0 --port $(API_PORT) --reload

frontend:
	cd frontend && PORT=$(WEB_PORT) HOST=0.0.0.0 BROWSER=none yarn start

seed:
	curl -sS -X POST http://127.0.0.1:$(API_PORT)/api/seed

import:
	./scripts/import-backup.sh

install:
	./scripts/install.sh

dev: mongo
	@echo "Start backend and frontend in two terminals: make backend && make frontend"
