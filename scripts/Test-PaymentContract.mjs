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
const { getPaymentRuntimeStatus } = loadTypeScriptModule(
  "src/lib/payments/status.ts"
);

assert.equal(typeof isSuccessfulPaymentStatus, "function");
assert.equal(typeof validateWebhookAmount, "function");

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

const originalOnlinePaymentsEnabled = process.env.ONLINE_PAYMENTS_ENABLED;
const originalPaymentProvider = process.env.PAYMENT_PROVIDER;

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
}

console.log("Payment contract helpers passed.");
