import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Analytics } from "@vercel/analytics/react";

const inter = Inter({ subsets: ["latin"] });

const title = "Spider A11y Checker — Web Accessibility Auditor";
const description =
  "Audit any website for accessibility issues. Check WCAG compliance, alt text, headings, landmarks, and form labels. Powered by Spider Cloud.";
const url = process.env.PUBLIC_NEXT_SITENAME || "https://a11y-checker.spider.cloud";

export const metadata: Metadata = {
  title,
  description,
  metadataBase: new URL(url),
  keywords: ["accessibility checker", "a11y audit", "WCAG", "web accessibility", "spider cloud"],
  authors: [{ name: "Spider", url: "https://spider.cloud" }],
  creator: "Spider",
  publisher: "Spider",
  openGraph: {
    type: "website",
    url,
    title,
    description,
    siteName: "Spider Cloud",
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
    creator: "@spider_rust",
  },
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
    ],
  },
  alternates: {
    canonical: url,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className={inter.className}>{children}<Analytics />
      </body>
    </html>
  );
}
