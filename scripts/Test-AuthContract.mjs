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

const {
  getRequestSiteUrl,
  getSiteUrl,
  normalizeSiteUrl,
} = loadTypeScriptModule("src/lib/site-url.ts");

const loginRoute = readFileSync("src/app/api/auth/login/route.ts", "utf8");
const callbackPage = readFileSync("src/app/auth/callback/page.tsx", "utf8");
const workflow = readFileSync(".github/workflows/code-quality.yml", "utf8");

const originalSiteUrl = process.env.NEXT_PUBLIC_SITE_URL;
const originalVercelUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL;

try {
  delete process.env.NEXT_PUBLIC_SITE_URL;
  delete process.env.VERCEL_PROJECT_PRODUCTION_URL;

  assert.equal(normalizeSiteUrl("www.jizhidao-ai.com"), "https://www.jizhidao-ai.com");
  assert.equal(normalizeSiteUrl("https://www.jizhidao-ai.com/path?q=1"), "https://www.jizhidao-ai.com");
  assert.equal(normalizeSiteUrl("ftp://www.jizhidao-ai.com"), null);
  assert.equal(getSiteUrl(), "https://www.jizhidao-ai.com");

  process.env.VERCEL_PROJECT_PRODUCTION_URL = "jizhidao-ai.vercel.app";
  assert.equal(getSiteUrl(), "https://jizhidao-ai.vercel.app");

  process.env.NEXT_PUBLIC_SITE_URL = "https://www.jizhidao-ai.com";
  assert.equal(
    getRequestSiteUrl(new URL("https://preview.example.com/api/auth/login")),
    "https://www.jizhidao-ai.com"
  );
  assert.equal(
    getRequestSiteUrl(new URL("http://localhost:3000/api/auth/login")),
    "http://localhost:3000"
  );

  process.env.NEXT_PUBLIC_SITE_URL = "http://localhost:3000";
  assert.equal(
    getRequestSiteUrl(new URL("https://www.jizhidao-ai.com/api/auth/login")),
    "https://www.jizhidao-ai.com"
  );
} finally {
  if (typeof originalSiteUrl === "undefined") {
    delete process.env.NEXT_PUBLIC_SITE_URL;
  } else {
    process.env.NEXT_PUBLIC_SITE_URL = originalSiteUrl;
  }

  if (typeof originalVercelUrl === "undefined") {
    delete process.env.VERCEL_PROJECT_PRODUCTION_URL;
  } else {
    process.env.VERCEL_PROJECT_PRODUCTION_URL = originalVercelUrl;
  }
}

assert.match(
  loginRoute,
  /const siteUrl = getRequestSiteUrl\(requestUrl\);/,
  "Login route must build magic-link callbacks from the request-aware site URL helper"
);
assert.match(
  loginRoute,
  /new URL\("\/auth\/callback", siteUrl\)/,
  "Login route must redirect magic links through the auth callback page"
);
assert.match(
  loginRoute,
  /callbackUrl\.searchParams\.set\("next", "\/chat\?welcome=1"\)/,
  "Login route must keep the post-login destination explicit"
);
assert.match(
  loginRoute,
  /shouldCreateUser:\s*true/,
  "Magic-link login must still allow first-time users to create accounts"
);
assert.match(
  loginRoute,
  /redirectHost:\s*new URL\(emailRedirectTo\)\.host/,
  "Login route should expose the redirect host for safe diagnostics"
);

assert.match(
  callbackPage,
  /value\?\.startsWith\("\/"\) && !value\.startsWith\("\/\/"\)/,
  "Auth callback must reject protocol-relative next redirects"
);
assert.match(
  callbackPage,
  /supabase\.auth\.exchangeCodeForSession\(code\)/,
  "Auth callback must support PKCE code exchange links"
);
assert.match(
  callbackPage,
  /supabase\.auth\.setSession\(\{[\s\S]*access_token:[\s\S]*refresh_token:/,
  "Auth callback must support hash token links"
);
assert.match(
  workflow,
  /npm run test:auth-contract/,
  "Code quality workflow must run auth contract checks"
);

console.log("Auth contract helpers passed.");
