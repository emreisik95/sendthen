import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { socialPreviewImage } from "@/lib/marketing";
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
  "An open-source, self-hosted email control plane with portable state and your choice of SES, SMTP relay, direct MX, or local sandbox transport.";

const SOCIAL_TITLE = "sendthen — Own your email stack.";

export const metadata: Metadata = {
  metadataBase: new URL("https://sendthen.net"),
  title: {
    default: SOCIAL_TITLE,
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
    title: SOCIAL_TITLE,
    description: DESCRIPTION,
    images: [
      {
        ...socialPreviewImage,
        width: 1200,
        height: 630,
      },
    ],
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: SOCIAL_TITLE,
    description: DESCRIPTION,
    images: [socialPreviewImage],
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
