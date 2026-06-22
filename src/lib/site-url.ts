const DEFAULT_SITE_URL = "https://www.jizhidao-ai.com";

function isLocalHostname(hostname: string) {
  return (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "::1"
  );
}

export function normalizeSiteUrl(value: string | undefined | null) {
  if (!value) return null;

  try {
    const hasExplicitScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(value);

    if (
      hasExplicitScheme &&
      !value.startsWith("http://") &&
      !value.startsWith("https://")
    ) {
      return null;
    }

    const url = new URL(
      value.startsWith("http://") || value.startsWith("https://")
        ? value
        : `https://${value}`
    );

    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return null;
    }

    return url.origin;
  } catch {
    return null;
  }
}

export function getSiteUrl() {
  const configuredUrl = normalizeSiteUrl(process.env.NEXT_PUBLIC_SITE_URL);
  if (configuredUrl) return configuredUrl;

  const vercelUrl = normalizeSiteUrl(process.env.VERCEL_PROJECT_PRODUCTION_URL);
  if (vercelUrl) return vercelUrl;

  return DEFAULT_SITE_URL;
}

export function getRequestSiteUrl(requestUrl: URL) {
  const requestOrigin = normalizeSiteUrl(requestUrl.origin);
  const configuredUrl = normalizeSiteUrl(process.env.NEXT_PUBLIC_SITE_URL);
  const requestIsLocal = isLocalHostname(requestUrl.hostname);
  const configuredIsLocal = configuredUrl
    ? isLocalHostname(new URL(configuredUrl).hostname)
    : false;

  if (requestIsLocal) {
    if (configuredUrl && configuredIsLocal) {
      return configuredUrl;
    }

    return requestOrigin || "http://localhost:3000";
  }

  if (configuredUrl && !configuredIsLocal) {
    return configuredUrl;
  }

  return requestOrigin || getSiteUrl();
}
