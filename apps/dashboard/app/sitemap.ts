import type { MetadataRoute } from "next";
import { SITE } from "../lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  const routes = [
    { path: "", changeFrequency: "daily" as const, priority: 1.0 },
    { path: "/faq", changeFrequency: "weekly" as const, priority: 0.8 },
    { path: "/privacy", changeFrequency: "monthly" as const, priority: 0.5 },
    { path: "/terms", changeFrequency: "monthly" as const, priority: 0.5 },
  ];

  return routes.map((route) => ({
    url: `${SITE.url}${route.path}`,
    lastModified: new Date(),
    changeFrequency: route.changeFrequency,
    priority: route.priority,
  }));
}
