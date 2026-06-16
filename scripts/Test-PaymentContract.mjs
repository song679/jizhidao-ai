import assert from "node:assert/strict";
import Module from "node:module";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const ts = require("typescript");

const contractPath = resolve("src/lib/payments/contract.ts");
const source = readFileSync(contractPath, "utf8");
const transpiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2020,
    esModuleInterop: true,
  },
  fileName: contractPath,
});

const contractModule = new Module(contractPath);
contractModule.filename = contractPath;
contractModule.paths = Module._nodeModulePaths(process.cwd());
contractModule._compile(transpiled.outputText, contractPath);

const {
  isSuccessfulPaymentStatus,
  validateWebhookAmount,
} = contractModule.exports;

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

console.log("Payment contract helpers passed.");
