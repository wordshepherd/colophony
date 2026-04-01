import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Colophony",
    short_name: "Colophony",
    description: "Submissions, managed.",
    start_url: "/",
    display: "standalone",
    background_color: "#191c2b",
    theme_color: "#191c2b",
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };
}
