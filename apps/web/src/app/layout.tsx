import type { Metadata } from "next";
import { playfairDisplay, lato } from "@/lib/fonts";
import "./globals.css";
import { Providers } from "@/components/providers";

export const metadata: Metadata = {
  title: {
    default: "Colophony",
    template: "%s | Colophony",
  },
  description:
    "Open-source editorial workflow for literary magazines — from submission to publication.",
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
  ),
  openGraph: {
    title: "Colophony",
    description: "Submissions, managed.",
    siteName: "Colophony",
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Colophony",
    description:
      "Open-source editorial workflow for literary magazines — from submission to publication.",
  },
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "32x32" },
      { url: "/icon.svg", type: "image/svg+xml" },
    ],
    apple: "/apple-icon.png",
  },
  other: {
    "theme-color": "#191c2b",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${playfairDisplay.variable} ${lato.variable} antialiased`}
      >
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
