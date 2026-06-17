# Payment Provider Adapter Contract

Updated: 2026-06-16

This note records the code-level boundary for future online payment providers.
It intentionally contains no merchant credentials, API keys, certificates,
database rows, or user data.

## Current state

The production site still uses manual recharge confirmation. The database
safety foundation for online payment callbacks is already in place, but no real
payment provider is live yet.

Do not mark an order as paid from browser redirects, screenshots, or client-side
payment results. Points must only be credited after a server-side webhook has
passed provider signature verification and amount validation.

## Runtime guardrails

Environment variables are documented in `.env.example`:

- `ONLINE_PAYMENTS_ENABLED=false`
- `PAYMENT_PROVIDER=manual`

These variables are guardrails, not a complete payment implementation. The
runtime status endpoint must keep online payment disabled until a real provider
adapter and signed webhook route exist. Accidentally setting
`ONLINE_PAYMENTS_ENABLED=true` must not make browser checkout appear live by
itself.

## Contract file

Provider adapters should implement:

`src/lib/payments/contract.ts`

The contract defines:

- Provider ids: `wechat`, `alipay`, `stripe`, `manual`, `sandbox`
- Payment session creation input and output
- Signed webhook verification input
- Normalized verified webhook output
- Successful-payment and amount-validation helpers

## Required provider flow

1. Create or reuse a pending recharge order.
2. Create a provider payment session for that exact order number and amount.
3. Receive the raw HTTPS webhook body.
4. Verify the provider signature with the provider's official method.
5. Normalize the event into `VerifiedPaymentWebhook`.
6. Validate that the webhook amount exactly matches the order amount.
7. Call the database atomic completion function only for verified paid events.
8. Treat repeated webhook event ids as successful idempotent retries, not as a
   second recharge.

## Things the adapter must never do

- Never log full raw payment payloads if they contain sensitive payer details.
- Never store private keys or merchant secrets in source control.
- Never trust query parameters from a success redirect as proof of payment.
- Never credit points if the order amount and webhook amount differ.
- Never credit points from unsigned, expired, replayed, or malformed callbacks.

## Next implementation step

After choosing the first payment provider, add a provider-specific adapter under
`src/lib/payments/` and wire it to a dedicated server route. Keep the existing
manual recharge flow available as a fallback until real sandbox or low-value
production transactions have been verified end-to-end.

## Pre-launch checklist for online payments

Before changing `ONLINE_PAYMENTS_ENABLED` away from `false`, complete every item
below:

- A provider-specific adapter exists and implements the shared contract.
- The webhook route verifies signatures from the raw request body before parsing
  or trusting any payment result.
- Amount validation uses the stored order amount, not a client-submitted amount.
- Duplicate webhook event ids are treated idempotently.
- Failed, closed, refunded, or unknown payment events never credit points.
- The manual recharge flow remains available while the provider is being tested.
- Sandbox or low-value production tests have covered paid, duplicate, wrong
  amount, malformed signature, and refund/close cases.
- `npm run test:payment-contract`, `npm run typecheck`, `npm run lint`, and
  `npm run test:production` pass after deployment.

Until these checks are complete, the expected runtime mode is still `manual`.
