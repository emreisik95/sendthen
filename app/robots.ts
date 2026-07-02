import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/api/", "/onboarding", "/t/", "/unsubscribe/", "/invite/"],
      },
    ],
    sitemap: "https://sendthen.net/sitemap.xml",
  };
}
