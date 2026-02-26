#!/bin/bash
# Kekkonsnap QA — curl-based API route testing against doc/PLAN.md spec
set -euo pipefail

BASE="http://localhost:3000"
SLUG="our-wedding"
COOKIE_JAR="/tmp/kekkon_qa_cookies.txt"
ADMIN_COOKIE="/tmp/kekkon_qa_admin.txt"
PASS=0
FAIL=0
WARN=0

pass() { PASS=$((PASS+1)); echo "  ✅ PASS: $1"; }
fail() { FAIL=$((FAIL+1)); echo "  ❌ FAIL: $1"; }
warn() { WARN=$((WARN+1)); echo "  ⚠️  WARN: $1"; }

rm -f "$COOKIE_JAR" "$ADMIN_COOKIE"

echo "========================================"
echo "KEKKONSNAP QA — API Route Testing"
echo "========================================"
echo ""

# -------------------------------------------------------
# 1. GET /api/events/[slug] — event public info
# -------------------------------------------------------
echo "--- 1. GET /api/events/$SLUG (event public info) ---"
RESP=$(curl -s -m 10 "$BASE/api/events/$SLUG")
echo "$RESP" | python3 -m json.tool 2>/dev/null || echo "$RESP"

if echo "$RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); assert d['name'] and d['slug'] and d['status'] and d['shotLimit'] and d['termsText']" 2>/dev/null; then
  pass "Returns name, slug, status, shotLimit, termsText"
else
  fail "Missing expected fields in event info"
fi

# Check it does NOT leak adminPasswordHash
if echo "$RESP" | grep -q "adminPasswordHash"; then
  fail "Leaks adminPasswordHash in public response!"
else
  pass "Does not leak adminPasswordHash"
fi

echo ""

# -------------------------------------------------------
# 2. GET /api/events/[slug]/guests — guest list
# -------------------------------------------------------
echo "--- 2. GET /api/events/$SLUG/guests (guest list for autocomplete) ---"
RESP=$(curl -s -m 10 "$BASE/api/events/$SLUG/guests")
echo "$RESP" | python3 -m json.tool 2>/dev/null || echo "$RESP"

if echo "$RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); assert isinstance(d, list) or isinstance(d.get('guests',[]), list)" 2>/dev/null; then
  pass "Returns guest list (array or object with guests)"
else
  # Check if it requires a guestId or similar
  warn "Guest list response unexpected format: $RESP"
fi

echo ""

# -------------------------------------------------------
# 3. POST /api/events/[slug]/identify — create session
# -------------------------------------------------------
echo "--- 3. POST /api/events/$SLUG/identify (create session) ---"
RESP=$(curl -s -m 10 -X POST "$BASE/api/events/$SLUG/identify" \
  -H "Content-Type: application/json" \
  -d '{"guestId": 1}' \
  -c "$COOKIE_JAR" \
  -D /tmp/kekkon_qa_identify_headers.txt)
echo "$RESP" | python3 -m json.tool 2>/dev/null || echo "$RESP"

if grep -qi "set-cookie" /tmp/kekkon_qa_identify_headers.txt 2>/dev/null; then
  pass "Sets session cookie on identify"
else
  fail "No Set-Cookie header on identify"
fi

if echo "$RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); assert d.get('sessionId') or d.get('session') or d.get('guest')" 2>/dev/null; then
  pass "Returns session/guest info"
else
  warn "Identify response format: $RESP"
fi

echo ""

# -------------------------------------------------------
# 4. POST /api/events/[slug]/agree — record terms consent
# -------------------------------------------------------
echo "--- 4. POST /api/events/$SLUG/agree (terms consent) ---"
RESP=$(curl -s -m 10 -X POST "$BASE/api/events/$SLUG/agree" \
  -H "Content-Type: application/json" \
  -b "$COOKIE_JAR" \
  -c "$COOKIE_JAR")
echo "$RESP" | python3 -m json.tool 2>/dev/null || echo "$RESP"

if echo "$RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); assert 'error' not in d or d.get('agreed') or d.get('success')" 2>/dev/null; then
  pass "Agree endpoint responds without error"
else
  warn "Agree response: $RESP"
fi

echo ""

# -------------------------------------------------------
# 5. GET /api/events/[slug]/photos/mine — own photos
# -------------------------------------------------------
echo "--- 5. GET /api/events/$SLUG/photos/mine (own photos) ---"
RESP=$(curl -s -m 10 "$BASE/api/events/$SLUG/photos/mine" \
  -b "$COOKIE_JAR")
echo "$RESP" | python3 -m json.tool 2>/dev/null || echo "$RESP"

if echo "$RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); assert isinstance(d, list) or 'photos' in d" 2>/dev/null; then
  pass "Returns photos array for session guest"
else
  warn "My photos response: $RESP"
fi

echo ""

# -------------------------------------------------------
# 6. GET /api/events/[slug]/photos/all — all photos (should be restricted)
# -------------------------------------------------------
echo "--- 6. GET /api/events/$SLUG/photos/all (all photos — should restrict during active) ---"
RESP=$(curl -s -m 10 "$BASE/api/events/$SLUG/photos/all" \
  -b "$COOKIE_JAR")
echo "$RESP" | python3 -m json.tool 2>/dev/null || echo "$RESP"

if echo "$RESP" | grep -qi "error\|not.*announced\|locked\|403\|unauthorized"; then
  pass "All photos restricted when event is active/locked"
else
  warn "All photos response during active event: $RESP"
fi

echo ""

# -------------------------------------------------------
# 7. GET /api/events/[slug]/status — SSE stream
# -------------------------------------------------------
echo "--- 7. GET /api/events/$SLUG/status (SSE stream — check headers) ---"
HEADERS=$(curl -s -m 3 -D - "$BASE/api/events/$SLUG/status" \
  -b "$COOKIE_JAR" -o /dev/null 2>&1 || true)
echo "$HEADERS"

if echo "$HEADERS" | grep -qi "text/event-stream"; then
  pass "SSE endpoint returns text/event-stream content type"
else
  fail "SSE endpoint does not return text/event-stream"
fi

echo ""

# -------------------------------------------------------
# 8. GET /api/events/[slug]/session — session info
# -------------------------------------------------------
echo "--- 8. GET /api/events/$SLUG/session (session status) ---"
RESP=$(curl -s -m 10 "$BASE/api/events/$SLUG/session" \
  -b "$COOKIE_JAR")
echo "$RESP" | python3 -m json.tool 2>/dev/null || echo "$RESP"
echo "(Info endpoint — checking if it returns session data)"

echo ""

# -------------------------------------------------------
# 9. POST /api/events/[slug]/photos — upload (without file)
# -------------------------------------------------------
echo "--- 9. POST /api/events/$SLUG/photos (upload — missing file should error) ---"
RESP=$(curl -s -m 10 -X POST "$BASE/api/events/$SLUG/photos" \
  -b "$COOKIE_JAR")
echo "$RESP" | python3 -m json.tool 2>/dev/null || echo "$RESP"

if echo "$RESP" | grep -qi "error\|required\|missing\|file"; then
  pass "Upload rejects request without file"
else
  warn "Upload without file response: $RESP"
fi

echo ""

# -------------------------------------------------------
# 10. Invalid event slug — should 404
# -------------------------------------------------------
echo "--- 10. GET /api/events/nonexistent-slug (should 404) ---"
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -m 10 "$BASE/api/events/nonexistent-slug")
echo "HTTP $HTTP_CODE"

if [ "$HTTP_CODE" = "404" ]; then
  pass "Returns 404 for invalid slug"
else
  fail "Returns $HTTP_CODE instead of 404 for invalid slug"
fi

echo ""
echo "========================================"
echo "ADMIN API ROUTES QA"
echo "========================================"
echo ""

# -------------------------------------------------------
# 11. POST /api/admin/[slug]/login — admin auth
# -------------------------------------------------------
echo "--- 11. POST /api/admin/$SLUG/login (admin login) ---"
RESP=$(curl -s -m 10 -X POST "$BASE/api/admin/$SLUG/login" \
  -H "Content-Type: application/json" \
  -d '{"password":"admin123"}' \
  -c "$ADMIN_COOKIE" \
  -D /tmp/kekkon_qa_admin_headers.txt)
echo "$RESP" | python3 -m json.tool 2>/dev/null || echo "$RESP"

if grep -qi "set-cookie" /tmp/kekkon_qa_admin_headers.txt 2>/dev/null; then
  pass "Admin login sets cookie"
else
  fail "Admin login does not set cookie"
fi

echo ""

# -------------------------------------------------------
# 12. POST /api/admin/[slug]/login — wrong password
# -------------------------------------------------------
echo "--- 12. POST /api/admin/$SLUG/login (wrong password) ---"
RESP=$(curl -s -m 10 -X POST "$BASE/api/admin/$SLUG/login" \
  -H "Content-Type: application/json" \
  -d '{"password":"wrongpassword"}')
echo "$RESP" | python3 -m json.tool 2>/dev/null || echo "$RESP"

if echo "$RESP" | grep -qi "error\|invalid\|unauthorized\|incorrect"; then
  pass "Rejects wrong password"
else
  fail "Does not properly reject wrong password"
fi

echo ""

# -------------------------------------------------------
# 13. GET /api/admin/[slug]/photos — admin photo list
# -------------------------------------------------------
echo "--- 13. GET /api/admin/$SLUG/photos (admin photo list) ---"
RESP=$(curl -s -m 10 "$BASE/api/admin/$SLUG/photos" \
  -b "$ADMIN_COOKIE")
echo "$RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); print(f'Type: {type(d).__name__}, Count: {len(d) if isinstance(d,list) else \"N/A\"}')" 2>/dev/null || echo "$RESP"

echo ""

# -------------------------------------------------------
# 14. GET /api/admin/[slug]/stats — event stats
# -------------------------------------------------------
echo "--- 14. GET /api/admin/$SLUG/stats (event stats) ---"
RESP=$(curl -s -m 10 "$BASE/api/admin/$SLUG/stats" \
  -b "$ADMIN_COOKIE")
echo "$RESP" | python3 -m json.tool 2>/dev/null || echo "$RESP"

echo ""

# -------------------------------------------------------
# 15. GET /api/admin/[slug]/guests — guest list
# -------------------------------------------------------
echo "--- 15. GET /api/admin/$SLUG/guests (admin guest list) ---"
RESP=$(curl -s -m 10 "$BASE/api/admin/$SLUG/guests" \
  -b "$ADMIN_COOKIE")
echo "$RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); print(f'Type: {type(d).__name__}, Count: {len(d) if isinstance(d,list) else \"N/A\"}')" 2>/dev/null || echo "$RESP"

echo ""

# -------------------------------------------------------
# 16. Admin without auth — should reject
# -------------------------------------------------------
echo "--- 16. GET /api/admin/$SLUG/photos (no auth — should reject) ---"
HTTP_CODE=$(curl -s -o /tmp/kekkon_qa_noauth.txt -w "%{http_code}" -m 10 "$BASE/api/admin/$SLUG/photos")
echo "HTTP $HTTP_CODE"
cat /tmp/kekkon_qa_noauth.txt | python3 -m json.tool 2>/dev/null || cat /tmp/kekkon_qa_noauth.txt

if [ "$HTTP_CODE" = "401" ] || [ "$HTTP_CODE" = "403" ]; then
  pass "Admin routes reject unauthenticated requests"
else
  fail "Admin route without auth returns $HTTP_CODE (expected 401/403)"
fi

echo ""

# -------------------------------------------------------
# 17. POST /api/admin/[slug]/lock — lock event
# -------------------------------------------------------
echo "--- 17. POST /api/admin/$SLUG/lock (lock event) ---"
RESP=$(curl -s -m 10 -X POST "$BASE/api/admin/$SLUG/lock" \
  -b "$ADMIN_COOKIE")
echo "$RESP" | python3 -m json.tool 2>/dev/null || echo "$RESP"

echo ""

# Check event status after lock
echo "--- 17b. Verify event status after lock ---"
RESP=$(curl -s -m 10 "$BASE/api/events/$SLUG")
STATUS=$(echo "$RESP" | python3 -c "import sys,json; print(json.load(sys.stdin)['status'])" 2>/dev/null)
echo "Event status: $STATUS"

if [ "$STATUS" = "locked" ]; then
  pass "Event status changed to locked"
else
  fail "Event status is '$STATUS' instead of 'locked'"
fi

echo ""

# -------------------------------------------------------
# 18. POST /api/admin/[slug]/pick-winner — (no photos, should error gracefully)
# -------------------------------------------------------
echo "--- 18. POST /api/admin/$SLUG/pick-winner (pick winner) ---"
RESP=$(curl -s -m 10 -X POST "$BASE/api/admin/$SLUG/pick-winner" \
  -H "Content-Type: application/json" \
  -d '{"photoId": 999}' \
  -b "$ADMIN_COOKIE")
echo "$RESP" | python3 -m json.tool 2>/dev/null || echo "$RESP"

echo ""

# -------------------------------------------------------
# RESET: Unlock the event back to active for user
# -------------------------------------------------------
echo "--- RESET: Setting event back to active ---"
# Use sqlite3 to reset
sqlite3 data/kekkonsnap.db "UPDATE events SET status='active', locked_at=NULL WHERE slug='$SLUG';" 2>/dev/null && echo "Reset to active" || echo "Could not reset (sqlite3 may not be available)"

echo ""
echo "========================================"
echo "PAGE RENDERING QA"
echo "========================================"
echo ""

for PAGE in "/$SLUG" "/$SLUG/terms" "/$SLUG/camera" "/$SLUG/photos" "/$SLUG/winner" "/$SLUG/gallery" "/admin/$SLUG" "/admin/$SLUG/dashboard"; do
  HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -m 10 "$BASE$PAGE")
  if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "307" ] || [ "$HTTP_CODE" = "302" ]; then
    pass "Page $PAGE renders (HTTP $HTTP_CODE)"
  else
    fail "Page $PAGE returns HTTP $HTTP_CODE"
  fi
done

echo ""
echo "========================================"
echo "SUMMARY"
echo "========================================"
echo "  ✅ Passed: $PASS"
echo "  ❌ Failed: $FAIL"
echo "  ⚠️  Warnings: $WARN"
echo "========================================"

# Cleanup
rm -f "$COOKIE_JAR" "$ADMIN_COOKIE" /tmp/kekkon_qa_*.txt
