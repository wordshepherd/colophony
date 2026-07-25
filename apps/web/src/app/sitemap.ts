import type { MetadataRoute } from "next";
import { clientEnv } from "@/env";

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = clientEnv.NEXT_PUBLIC_APP_URL;

  return [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 1,
    },
    {
      url: `${baseUrl}/identity`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.5,
    },
  ];
}
