import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://colophony.pub";

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
