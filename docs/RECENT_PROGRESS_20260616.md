# Recent Progress Snapshot - 2026-06-16

This file is a lightweight recovery note for future Codex/ChatGPT sessions.
It records recent implementation progress only. It does not contain secrets,
API keys, user data, database rows, or production credentials.

## Current production project

- Repository: `https://github.com/song679/jizhidao-ai`
- Production site: `https://www.jizhidao-ai.com`
- Production branch: `main`
- Runtime: Next.js App Router, Supabase, Vercel

## Recent completed work

### Online payment safety foundation

- Added database migration: `supabase/migrations/20260615_payment_webhook_safety.sql`
- Added payment integration notes: `docs/PAYMENT_INTEGRATION.md`
- Added webhook event ledger, idempotency checks, amount validation, payment identifiers, and atomic online recharge completion function.
- Production Supabase migration was executed by the project owner.

### Admin payment monitoring

- Added admin payment event API: `/api/admin/payment-events`
- Added admin payment monitoring page: `/admin/payments`
- Added filters, search, pagination, 30-second refresh, and CSV export.
- Added payment incident alerts to admin dashboard and system status checks.

### Recharge order reconciliation

- Added CSV export for `/admin/orders`.
- Export respects the current order status filter and search term.
- Export includes order number, email, plan, amount, points, status, payment channel, reference, admin email, note, and timestamps.
- CSV cells are escaped and protected from spreadsheet formula injection.

### Point transaction export hardening

- Existing `/admin/transactions` CSV export was hardened against spreadsheet formula injection.

### Dynamic API declarations

The following account-sensitive or admin-sensitive APIs are explicitly marked dynamic:

- `/api/account/delete`
- `/api/account/export`
- `/api/admin/dashboard`
- `/api/admin/orders`
- `/api/admin/payment-events`
- `/api/admin/recharge`
- `/api/admin/system`
- `/api/admin/transactions`
- `/api/admin/users`
- `/api/auth/login`
- `/api/chat`
- `/api/chat/config`
- `/api/chat/history`
- `/api/chat/sessions`
- `/api/orders`
- `/api/points`

Reason: these endpoints depend on auth state, realtime account/order/point data,
environment variables, or admin authorization. They should not be statically optimized.

### Production smoke test hardening

- The production smoke script now checks the public AI model configuration API.
- It verifies that the selected model and model option list are present and
  structurally valid.
- Latest production smoke result: 42 checks passed.

### Payment provider adapter boundary

- Added a code-level provider adapter contract:
  `src/lib/payments/contract.ts`
- Added an implementation note:
  `docs/PAYMENT_PROVIDER_ADAPTER_CONTRACT.md`
- This prepares the project for a future real payment provider without changing
  the current manual recharge flow.

### Payment contract regression test

- Added `scripts/Test-PaymentContract.mjs`.
- Added `npm.cmd run test:payment-contract`.
- GitHub Actions now verifies the payment helper behavior before lint and
  schema checks.

## Recent validated commits

- `70654fe` - add online payment safety foundation
- `f9e835b` - monitor online payment database readiness
- `0e95d24` - fix cross-platform schema snapshot hashes
- `ac2d81c` - add payment webhook monitoring
- `e5a85f0` - add payment incident alerts
- `992df64` - add payment event csv export
- `0e0f882` - add recharge order csv export
- `45fa2aa` - harden transaction csv export
- `a771570` - mark user orders api dynamic
- `be12ba5` - mark admin apis dynamic
- `3b16895` - mark user apis dynamic
- `ceb7e1d` - extend production model smoke checks

## Standard validation commands

Run these before pushing:

```powershell
npm.cmd run typecheck
npm.cmd run test:payment-contract
npm.cmd run lint
npm.cmd run db:schema:validate
git diff --check
```

Production smoke check:

```powershell
npm.cmd run test:production
```

## Next recommended work

1. Choose the first real payment provider and product flow.
2. Implement provider-specific create-payment and signed-webhook adapters using
   `src/lib/payments/contract.ts`.
3. Keep manual recharge as fallback until online payment has been verified end-to-end.
4. Continue production smoke checks and schema snapshot validation after database changes.
