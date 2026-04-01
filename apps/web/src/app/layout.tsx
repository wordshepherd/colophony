import type { Metadata } from "next";
import { playfairDisplay, lato } from "@/lib/fonts";
import "./globals.css";
import { Providers } from "@/components/providers";

export const metadata: Metadata = {
  title: "Colophony - Submissions Platform",
  description: "Multi-tenant submissions management platform",
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
