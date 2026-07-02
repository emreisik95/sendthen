import type { MetadataRoute } from "next";

const BASE = "https://sendthen.net";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: `${BASE}/`,
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: `${BASE}/docs`,
      changeFrequency: "weekly",
      priority: 0.8,
    },
    {
      url: `${BASE}/login`,
      changeFrequency: "yearly",
      priority: 0.3,
    },
    {
      url: `${BASE}/signup`,
      changeFrequency: "yearly",
      priority: 0.5,
    },
  ];
}
