import assert from "node:assert/strict";
import Module from "node:module";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const ts = require("typescript");

function loadTypeScriptModule(path) {
  const modulePath = resolve(path);
  const source = readFileSync(modulePath, "utf8");
  const transpiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      esModuleInterop: true,
    },
    fileName: modulePath,
  });

  const compiledModule = new Module(modulePath);
  compiledModule.filename = modulePath;
  compiledModule.paths = Module._nodeModulePaths(process.cwd());
  compiledModule._compile(transpiled.outputText, modulePath);

  return compiledModule.exports;
}

const contractModule = loadTypeScriptModule("src/lib/payments/contract.ts");
const {
  isSuccessfulPaymentStatus,
  validateWebhookAmount,
} = contractModule;
const {
  getPaymentRuntimeStatus,
  publicPaymentRuntimeStatusKeys,
  toPublicPaymentRuntimeStatus,
} = loadTypeScriptModule("src/lib/payments/status.ts");
const envExample = readFileSync(".env.example", "utf8");
const pricingPage = readFileSync("src/app/pricing/page.tsx", "utf8");
const paymentStatusRoute = readFileSync("src/app/api/payments/status/route.ts", "utf8");
const packageJson = JSON.parse(readFileSync("package.json", "utf8"));
const expectedPublicPaymentStatusKeys = [
  "adapterImplemented",
  "manualRechargeEnabled",
  "mode",
  "onlinePaymentEnabled",
  "provider",
  "requestedOnlinePayments",
  "warnings",
];

assert.equal(typeof isSuccessfulPaymentStatus, "function");
assert.equal(typeof validateWebhookAmount, "function");
assert.deepEqual(
  [...publicPaymentRuntimeStatusKeys].sort(),
  expectedPublicPaymentStatusKeys,
  "Public payment runtime status keys must stay explicit"
);
assert.match(
  packageJson.scripts["test:contracts"],
  /test:payment-contract/,
  "Unified contract test script must include payment contract checks"
);

assert.equal(isSuccessfulPaymentStatus("paid"), true);
assert.equal(isSuccessfulPaymentStatus("refunded"), false);
assert.equal(isSuccessfulPaymentStatus("closed"), false);
assert.equal(isSuccessfulPaymentStatus("unknown"), false);
assert.equal(isSuccessfulPaymentStatus("unexpected"), false);

assert.equal(validateWebhookAmount(990, 990), true);
assert.equal(validateWebhookAmount(2990, 2990), true);
assert.equal(validateWebhookAmount(990, 991), false);
assert.equal(validateWebhookAmount(990, 989), false);
assert.equal(validateWebhookAmount(0, 0), false);
assert.equal(validateWebhookAmount(-100, -100), false);
assert.equal(validateWebhookAmount(100.5, 100.5), false);
assert.equal(validateWebhookAmount(Number.NaN, Number.NaN), false);

const publicStatus = toPublicPaymentRuntimeStatus({
  mode: "manual",
  manualRechargeEnabled: true,
  onlinePaymentEnabled: false,
  requestedOnlinePayments: false,
  provider: "manual",
  adapterImplemented: false,
  warnings: [],
  internalSecret: "must-not-leak",
});
assert.deepEqual(
  Object.keys(publicStatus).sort(),
  expectedPublicPaymentStatusKeys,
  "toPublicPaymentRuntimeStatus must strip unknown fields"
);

assert.match(
  envExample,
  /^ONLINE_PAYMENTS_ENABLED=false$/m,
  ".env.example must keep online payments disabled by default"
);
assert.match(
  envExample,
  /^PAYMENT_PROVIDER=manual$/m,
  ".env.example must default to the manual recharge provider"
);
assert.match(
  envExample,
  /Stripe/,
  ".env.example must document supported payment provider values"
);
assert.match(
  envExample,
  /^STRIPE_SECRET_KEY=$/m,
  ".env.example must document STRIPE_SECRET_KEY"
);
assert.match(
  envExample,
  /^STRIPE_WEBHOOK_SECRET=$/m,
  ".env.example must document STRIPE_WEBHOOK_SECRET"
);

assert.match(
  pricingPage,
  /fetch\("\/api\/payments\/status"/,
  "Pricing page must read the public payment runtime status endpoint"
);
assert.match(
  paymentStatusRoute,
  /toPublicPaymentRuntimeStatus\(getPaymentRuntimeStatus\(\)\)/,
  "Payment status API route must expose only the public runtime status shape"
);
assert.match(
  paymentStatusRoute,
  /"Cache-Control": "no-store"/,
  "Payment status API route must not cache runtime payment configuration"
);
assert.ok(
  pricingPage.includes("\u5f53\u524d\u4ecd\u4e3a\u624b\u52a8\u5145\u503c\u6a21\u5f0f"),
  "Pricing page must explain manual recharge mode to users"
);
assert.ok(
  pricingPage.includes("\u5f53\u524d\u5df2\u5f00\u542f\u5728\u7ebf\u652f\u4ed8"),
  "Pricing page must include the future online payment state message"
);

const originalOnlinePaymentsEnabled = process.env.ONLINE_PAYMENTS_ENABLED;
const originalPaymentProvider = process.env.PAYMENT_PROVIDER;
const originalStripeSecretKey = process.env.STRIPE_SECRET_KEY;
const originalStripeWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

try {
  delete process.env.ONLINE_PAYMENTS_ENABLED;
  delete process.env.PAYMENT_PROVIDER;

  assert.deepEqual(getPaymentRuntimeStatus(), {
    mode: "manual",
    manualRechargeEnabled: true,
    onlinePaymentEnabled: false,
    requestedOnlinePayments: false,
    provider: "manual",
    adapterImplemented: false,
    warnings: [],
  });

  process.env.ONLINE_PAYMENTS_ENABLED = "true";
  process.env.PAYMENT_PROVIDER = "wechat";

  assert.deepEqual(getPaymentRuntimeStatus(), {
    mode: "manual",
    manualRechargeEnabled: true,
    onlinePaymentEnabled: false,
    requestedOnlinePayments: true,
    provider: "wechat",
    adapterImplemented: false,
    warnings: ["online_payments_requested_but_adapter_not_implemented"],
  });

  process.env.PAYMENT_PROVIDER = "stripe";
  delete process.env.STRIPE_SECRET_KEY;
  delete process.env.STRIPE_WEBHOOK_SECRET;

  assert.deepEqual(getPaymentRuntimeStatus(), {
    mode: "manual",
    manualRechargeEnabled: true,
    onlinePaymentEnabled: false,
    requestedOnlinePayments: true,
    provider: "stripe",
    adapterImplemented: true,
    warnings: ["online_payments_requested_but_provider_not_configured"],
  });

  process.env.STRIPE_SECRET_KEY = "sk_test_contract";
  process.env.STRIPE_WEBHOOK_SECRET = "whsec_contract";

  assert.deepEqual(getPaymentRuntimeStatus(), {
    mode: "online",
    manualRechargeEnabled: true,
    onlinePaymentEnabled: true,
    requestedOnlinePayments: true,
    provider: "stripe",
    adapterImplemented: true,
    warnings: [],
  });

  process.env.PAYMENT_PROVIDER = "unknown-provider";
  delete process.env.STRIPE_SECRET_KEY;
  delete process.env.STRIPE_WEBHOOK_SECRET;

  assert.deepEqual(getPaymentRuntimeStatus(), {
    mode: "manual",
    manualRechargeEnabled: true,
    onlinePaymentEnabled: false,
    requestedOnlinePayments: true,
    provider: "manual",
    adapterImplemented: false,
    warnings: [
      "invalid_payment_provider",
      "online_payments_requested_but_adapter_not_implemented",
      "online_payments_requested_but_provider_not_configured",
    ],
  });
} finally {
  if (typeof originalOnlinePaymentsEnabled === "undefined") {
    delete process.env.ONLINE_PAYMENTS_ENABLED;
  } else {
    process.env.ONLINE_PAYMENTS_ENABLED = originalOnlinePaymentsEnabled;
  }

  if (typeof originalPaymentProvider === "undefined") {
    delete process.env.PAYMENT_PROVIDER;
  } else {
    process.env.PAYMENT_PROVIDER = originalPaymentProvider;
  }

  if (typeof originalStripeSecretKey === "undefined") {
    delete process.env.STRIPE_SECRET_KEY;
  } else {
    process.env.STRIPE_SECRET_KEY = originalStripeSecretKey;
  }

  if (typeof originalStripeWebhookSecret === "undefined") {
    delete process.env.STRIPE_WEBHOOK_SECRET;
  } else {
    process.env.STRIPE_WEBHOOK_SECRET = originalStripeWebhookSecret;
  }
}

console.log("Payment contract helpers passed.");
