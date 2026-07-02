import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
});

const DESCRIPTION =
  "Self-hosted transactional email platform. Send, track, deliver.";

export const metadata: Metadata = {
  metadataBase: new URL("https://sendthen.net"),
  title: {
    default: "sendthen — email for developers",
    template: "%s — sendthen",
  },
  description: DESCRIPTION,
  keywords: [
    "transactional email",
    "self-hosted email",
    "email API",
    "SMTP",
    "Amazon SES",
    "email tracking",
    "webhooks",
    "developer email",
    "open source email platform",
  ],
  applicationName: "sendthen",
  authors: [{ name: "Emre Işık", url: "https://github.com/emreisik95" }],
  creator: "Emre Işık",
  openGraph: {
    type: "website",
    url: "/",
    siteName: "sendthen",
    title: "sendthen — email for developers",
    description: DESCRIPTION,
    images: [
      {
        url: "/og.png",
        width: 1200,
        height: 630,
        alt: "sendthen — email that is deliverable",
      },
    ],
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "sendthen — email for developers",
    description: DESCRIPTION,
    images: ["/og.png"],
  },
  robots: {
    index: true,
    follow: true,
  },
  icons: {
    icon: [
      { url: "/icon-192.png", sizes: "192x192" },
      { url: "/icon-512.png", sizes: "512x512" },
    ],
  },
};

export const viewport: Viewport = {
  themeColor: "#08090A",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-bg text-fg">{children}</body>
    </html>
  );
}
