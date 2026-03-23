.PHONY: all build start stop restart deploy status logs logs-tunnel test test-e2e test-e2e-ui test-all tunnel tunnel-stop tunnel-setup tunnel-login tunnel-create tunnel-route

TUNNEL_NAME := mytunnel
TUNNEL_PORT := 3000
TUNNEL_DOMAIN := kekkonsnap.party

all: stop build start

build:
	npm run build
	cp -r .next/static .next/standalone/.next/static
	cp -r public .next/standalone/public

start:
	systemctl --user start kekkonsnap

stop:
	systemctl --user stop kekkonsnap

restart:
	systemctl --user restart kekkonsnap

deploy: stop build start tunnel

status:
	systemctl --user status kekkonsnap kekkonsnap-tunnel

logs:
	journalctl --user -u kekkonsnap -f

logs-tunnel:
	journalctl --user -u kekkonsnap-tunnel -f

tunnel:
	systemctl --user start kekkonsnap-tunnel

tunnel-stop:
	systemctl --user stop kekkonsnap-tunnel

tunnel-login:
	cloudflared tunnel login

tunnel-create:
	cloudflared tunnel create $(TUNNEL_NAME)

tunnel-route:
	cloudflared tunnel route dns $(TUNNEL_NAME) $(TUNNEL_DOMAIN)

tunnel-setup: tunnel-login tunnel-create tunnel-route

test:
	npm test

test-e2e:
	npx playwright test

test-e2e-ui:
	npx playwright test --ui

test-all: test test-e2e
