# Supabase SQL contract tests

Executable counterparts of the security audit findings. `rls_contracts.sql`
validates RLS on the content tables (VULN-1), the ratings DELETE policy (L-3),
and guards against RLS being disabled on the billing tables.
`resume_billing.sql` pins the atomic billing semantics of the ledger RPCs.

## Run locally

Prerequisites: [Supabase CLI](https://supabase.com/docs/guides/cli/getting-started),
Docker running, and `psql` on PATH (`brew install libpq` on macOS).

```bash
supabase start          # once: boots the local stack (auth schema included)
npm run test:db         # from next-src/: db reset + both contract suites
```

`test:db` applies all migrations in `../migrations/` to a clean local
database, then executes both files with `ON_ERROR_STOP=1` — any contract
violation exits non-zero.

## CI

The `db-contracts` job in `.github/workflows/deploy.yml` runs the same script
on every push/PR and gates the Pages deployment.
