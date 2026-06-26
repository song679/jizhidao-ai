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
const { isSuccessfulPaymentStatus, validateWebhookAmount } = contractModule;
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

assert.match(envExample, /^ONLINE_PAYMENTS_ENABLED=false$/m);
assert.match(envExample, /^PAYMENT_PROVIDER=manual$/m);
assert.match(envExample, /alipay, wechat, stripe, manual/);
assert.match(envExample, /^ALIPAY_APP_ID=$/m);
assert.match(envExample, /^ALIPAY_PRIVATE_KEY=$/m);
assert.match(envExample, /^ALIPAY_PUBLIC_KEY=$/m);
assert.match(envExample, /^WECHAT_APP_ID=$/m);
assert.match(envExample, /^WECHAT_MCH_ID=$/m);
assert.match(envExample, /^WECHAT_MCH_SERIAL_NO=$/m);
assert.match(envExample, /^WECHAT_PRIVATE_KEY=$/m);
assert.match(envExample, /^WECHAT_API_V3_KEY=$/m);
assert.match(envExample, /^WECHAT_PLATFORM_PUBLIC_KEY=$/m);
assert.match(envExample, /^STRIPE_SECRET_KEY=$/m);
assert.match(envExample, /^STRIPE_WEBHOOK_SECRET=$/m);

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
  pricingPage.includes("当前仍为手动充值模式"),
  "Pricing page must explain manual recharge mode to users"
);
assert.ok(
  pricingPage.includes("当前已开启在线支付"),
  "Pricing page must include the online payment state message"
);

const trackedEnvNames = [
  "ONLINE_PAYMENTS_ENABLED",
  "PAYMENT_PROVIDER",
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "ALIPAY_APP_ID",
  "ALIPAY_PRIVATE_KEY",
  "ALIPAY_PUBLIC_KEY",
  "WECHAT_APP_ID",
  "WECHAT_MCH_ID",
  "WECHAT_MCH_SERIAL_NO",
  "WECHAT_PRIVATE_KEY",
  "WECHAT_API_V3_KEY",
  "WECHAT_PLATFORM_PUBLIC_KEY",
];
const originalEnv = Object.fromEntries(
  trackedEnvNames.map((name) => [name, process.env[name]])
);

function clearProviderKeys() {
  for (const name of trackedEnvNames.slice(2)) {
    delete process.env[name];
  }
}

try {
  delete process.env.ONLINE_PAYMENTS_ENABLED;
  delete process.env.PAYMENT_PROVIDER;
  clearProviderKeys();

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
  process.env.PAYMENT_PROVIDER = "alipay";

  assert.deepEqual(getPaymentRuntimeStatus(), {
    mode: "manual",
    manualRechargeEnabled: true,
    onlinePaymentEnabled: false,
    requestedOnlinePayments: true,
    provider: "alipay",
    adapterImplemented: true,
    warnings: ["online_payments_requested_but_provider_not_configured"],
  });

  process.env.ALIPAY_APP_ID = "app_contract";
  process.env.ALIPAY_PRIVATE_KEY = "private_contract";
  process.env.ALIPAY_PUBLIC_KEY = "public_contract";

  assert.deepEqual(getPaymentRuntimeStatus(), {
    mode: "online",
    manualRechargeEnabled: true,
    onlinePaymentEnabled: true,
    requestedOnlinePayments: true,
    provider: "alipay",
    adapterImplemented: true,
    warnings: [],
  });

  clearProviderKeys();
  process.env.PAYMENT_PROVIDER = "wechat";

  assert.deepEqual(getPaymentRuntimeStatus(), {
    mode: "manual",
    manualRechargeEnabled: true,
    onlinePaymentEnabled: false,
    requestedOnlinePayments: true,
    provider: "wechat",
    adapterImplemented: true,
    warnings: ["online_payments_requested_but_provider_not_configured"],
  });

  process.env.WECHAT_APP_ID = "wx_contract";
  process.env.WECHAT_MCH_ID = "mch_contract";
  process.env.WECHAT_MCH_SERIAL_NO = "serial_contract";
  process.env.WECHAT_PRIVATE_KEY = "private_contract";
  process.env.WECHAT_API_V3_KEY = "12345678901234567890123456789012";
  process.env.WECHAT_PLATFORM_PUBLIC_KEY = "public_contract";

  assert.deepEqual(getPaymentRuntimeStatus(), {
    mode: "online",
    manualRechargeEnabled: true,
    onlinePaymentEnabled: true,
    requestedOnlinePayments: true,
    provider: "wechat",
    adapterImplemented: true,
    warnings: [],
  });

  clearProviderKeys();
  process.env.PAYMENT_PROVIDER = "stripe";

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

  clearProviderKeys();
  process.env.PAYMENT_PROVIDER = "unknown-provider";

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
  for (const name of trackedEnvNames) {
    if (typeof originalEnv[name] === "undefined") {
      delete process.env[name];
    } else {
      process.env[name] = originalEnv[name];
    }
  }
}

console.log("Payment contract helpers passed.");
