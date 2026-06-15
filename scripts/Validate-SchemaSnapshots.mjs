import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const projectRoot = path.resolve(import.meta.dirname, "..");
const snapshotDirectory = path.join(
  projectRoot,
  "supabase",
  "schema-snapshots"
);

const expectedTables = [
  "user_points",
  "point_transactions",
  "chat_sessions",
  "chat_messages",
  "chat_request_ledger",
  "recharge_orders",
];

const forbiddenPatterns = [
  {
    label: "pg_dump data block",
    pattern: /^\s*COPY\s+.+\s+FROM\s+stdin;\s*$/gim,
  },
  {
    label: "database connection URI",
    pattern: /postgres(?:ql)?:\/\/\S+/gi,
  },
  {
    label: "email address",
    pattern: /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi,
  },
  {
    label: "OpenAI-style API key",
    pattern: /\bsk-[a-z0-9_-]{12,}\b/gi,
  },
  {
    label: "Supabase secret key",
    pattern: /\bsb_secret_[a-z0-9_-]{12,}\b/gi,
  },
  {
    label: "JWT token",
    pattern: /\beyJ[a-zA-Z0-9_-]{20,}\.[a-zA-Z0-9_-]{20,}(?:\.[a-zA-Z0-9_-]+)?\b/g,
  },
];

function fail(message) {
  console.error(`Schema snapshot validation failed: ${message}`);
  process.exitCode = 1;
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const entries = await readdir(snapshotDirectory, { withFileTypes: true });
const snapshotNames = entries
  .filter(
    (entry) =>
      entry.isFile() &&
      /^public-schema-\d{8}-\d{6}\.sql$/i.test(entry.name)
  )
  .map((entry) => entry.name)
  .sort();

if (snapshotNames.length === 0) {
  fail("no public schema snapshots were found.");
} else {
  for (const snapshotName of snapshotNames) {
    const snapshotPath = path.join(snapshotDirectory, snapshotName);
    const hashPath = `${snapshotPath}.sha256`;
    const [snapshotBuffer, hashText] = await Promise.all([
      readFile(snapshotPath),
      readFile(hashPath, "utf8").catch(() => null),
    ]);

    if (!hashText) {
      fail(`${snapshotName} is missing its .sha256 file.`);
      continue;
    }

    const snapshotText = snapshotBuffer.toString("utf8");
    const canonicalSnapshot = snapshotText.replace(/\r\n/g, "\n");
    const actualHash = createHash("sha256")
      .update(canonicalSnapshot, "utf8")
      .digest("hex");
    const [expectedHash, recordedName] = hashText.trim().split(/\s+/, 2);

    if (expectedHash?.toLowerCase() !== actualHash) {
      fail(`${snapshotName} does not match its recorded SHA256.`);
    }

    if (recordedName !== snapshotName) {
      fail(`${snapshotName} has an invalid filename in its SHA256 record.`);
    }

    for (const { label, pattern } of forbiddenPatterns) {
      pattern.lastIndex = 0;
      if (pattern.test(snapshotText)) {
        fail(`${snapshotName} contains a forbidden ${label}.`);
      }
    }

    for (const table of expectedTables) {
      const tablePattern = new RegExp(
        `CREATE\\s+TABLE\\s+(?:IF\\s+NOT\\s+EXISTS\\s+)?"?public"?\\s*\\.\\s*"?${escapeRegExp(table)}"?\\s*\\(`,
        "i"
      );

      if (!tablePattern.test(snapshotText)) {
        fail(`${snapshotName} is missing the core table public.${table}.`);
      }
    }

    const functionCount = (
      snapshotText.match(/CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+/gi) || []
    ).length;
    const rlsCount = (
      snapshotText.match(/ENABLE\s+ROW\s+LEVEL\s+SECURITY/gi) || []
    ).length;

    if (functionCount === 0) {
      fail(`${snapshotName} does not contain database functions.`);
    }

    if (rlsCount < expectedTables.length) {
      fail(
        `${snapshotName} enables RLS on only ${rlsCount} tables; expected at least ${expectedTables.length}.`
      );
    }

    console.log(
      `Validated ${snapshotName}: ${snapshotBuffer.length} bytes, ${functionCount} functions, ${rlsCount} RLS entries.`
    );
  }
}

if (!process.exitCode) {
  console.log(`All ${snapshotNames.length} schema snapshot(s) passed validation.`);
}
