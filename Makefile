.PHONY: all build start stop test test-e2e test-e2e-ui test-all

all: stop build start

build:
	npm run build

start:
	nohup npm start > /tmp/kekkonsnap.log 2>&1 & echo $$! > .pid
	@echo "Server started (PID $$(cat .pid)), logs at /tmp/kekkonsnap.log"

stop:
	@PID=""; \
	if [ -f .pid ] && kill -0 $$(cat .pid) 2>/dev/null; then \
		PID=$$(cat .pid); \
	else \
		rm -f .pid; \
		PID=$$(pgrep -f "[n]ext-server" | head -1); \
	fi; \
	if [ -n "$$PID" ]; then \
		kill $$PID; \
		for i in 1 2 3 4 5 6 7 8 9 10; do \
			kill -0 $$PID 2>/dev/null || break; \
			sleep 0.5; \
		done; \
		kill -0 $$PID 2>/dev/null && kill -9 $$PID 2>/dev/null; \
		rm -f .pid; \
		echo "Server stopped (PID $$PID)"; \
	else \
		echo "No server running"; \
	fi

test:
	npm test

test-e2e:
	npx playwright test

test-e2e-ui:
	npx playwright test --ui

test-all: test test-e2e
