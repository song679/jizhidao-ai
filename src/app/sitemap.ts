import type { MetadataRoute } from "next";

const baseUrl = "https://www.jizhidao-ai.com";

export default function sitemap(): MetadataRoute.Sitemap {
  const routes = [
    "",
    "/chat",
    "/login",
    "/pricing",
    "/terms",
    "/privacy",
    "/refund",
    "/support",
  ];

  return routes.map((route) => ({
    url: `${baseUrl}${route}`,
    lastModified: new Date(),
    changeFrequency: route === "" ? "weekly" : "monthly",
    priority: route === "" ? 1 : route === "/chat" ? 0.9 : 0.6,
  }));
}
