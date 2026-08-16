#!/usr/bin/env bash
# Applies every migration to the local Supabase stack, then runs the SQL
# contract suites. Fails on the first SQL error (ON_ERROR_STOP=1).
#
# Prerequisites: Supabase CLI, Docker running, psql on PATH.
#   brew install supabase/tap/supabase libpq   # macOS example
#   supabase start                              # once, before this script
set -euo pipefail
cd "$(dirname "$0")/.."

DB_URL="${SUPABASE_DB_URL:-postgresql://postgres:postgres@127.0.0.1:54322/postgres}"

supabase db reset

psql "$DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/rls_contracts.sql
psql "$DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/resume_billing.sql

echo "SQL contracts passed."
