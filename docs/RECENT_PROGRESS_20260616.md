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
- Latest production smoke result: 45 checks passed.

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

### Payment runtime status endpoint

- Added public non-secret status endpoint: `/api/payments/status`.
- The endpoint reports whether the site is in manual or online payment mode.
- It currently keeps online payment disabled until a real provider adapter is
  implemented, even if an environment variable is accidentally set.
- Production smoke checks now verify the endpoint shape and `no-store` cache
  behavior.
- Payment contract tests now also cover manual mode, invalid provider
  warnings, and the online-payment-requested-but-not-implemented guard.
- Admin system diagnostics now include payment runtime mode, provider, online
  payment status, and payment configuration warnings.
- `.env.example` documents the payment guardrail variables:
  `ONLINE_PAYMENTS_ENABLED=false` and `PAYMENT_PROVIDER=manual`.
- Payment contract tests now assert that `.env.example` keeps online payments
  disabled by default and documents the supported provider values.
- The payment adapter contract now includes a pre-launch checklist for future
  online payment activation. The expected runtime mode remains `manual` until
  every checklist item is complete.

### Pricing page payment mode notice

- The pricing page now reads the public non-secret endpoint
  `/api/payments/status`.
- It shows users whether the site is still in manual recharge mode or future
  online payment mode.
- The payment contract regression test now verifies that the pricing page keeps
  the payment status endpoint call and both manual/online user-facing messages.

### Payment runtime smoke safety checks

- The production smoke script now separates payment status shape checks from
  payment runtime safety checks.
- The smoke check verifies that manual recharge stays enabled and online payment
  cannot be reported as enabled while no provider adapter is implemented.
- Latest production smoke result: 45 checks passed.

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
- `7635a10` - add payment provider adapter contract
- `bee595c` - test payment contract helpers
- `6a952d1` - expose payment runtime status
- `0b52382` - cover payment runtime status safeguards
- `6b9d00d` - show payment runtime in system diagnostics
- `4e73010` - update recovery snapshot with payment safeguards
- `82b5510` - sync recovery entrypoints with payment safeguards
- `2a2e56b` - document payment guardrail environment variables
- `67086d6` - test payment env guardrails
- `748c8c4` - document payment launch checklist
- `189fd52` - sync recovery docs with payment checklist
- `04dda60` - show payment mode on pricing page
- `0ea8339` - test pricing payment mode notice
- `41494b8` - sync recovery docs with pricing payment notice
- `baba424` - strengthen payment status smoke checks

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
