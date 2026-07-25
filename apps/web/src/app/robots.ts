import type { MetadataRoute } from "next";
import { clientEnv } from "@/env";

export default function robots(): MetadataRoute.Robots {
  const baseUrl = clientEnv.NEXT_PUBLIC_APP_URL;

  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/embed/", "/embed/status/", "/identity"],
        disallow: [
          "/submissions",
          "/settings",
          "/auth",
          "/api",
          "/editor",
          "/slate",
          "/operations",
          "/business",
          "/invite/accept/",
        ],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
