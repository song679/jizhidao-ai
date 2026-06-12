import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin/", "/api/"],
    },
    sitemap: "https://www.jizhidao-ai.com/sitemap.xml",
    host: "https://www.jizhidao-ai.com",
  };
}
