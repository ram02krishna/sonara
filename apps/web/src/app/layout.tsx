import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers/Providers";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Sonara — Modern Lossless Music Streaming",
  description:
    "Experience music at its pinnacle. Sonara merges the catalog depth of Spotify with Apple Music's pristine aesthetics, lossless audio, dynamic album reactive theming, and time-synced lyrics.",
  keywords: ["music streaming", "spotify", "lossless audio", "lyrics", "apple music", "bento dashboard"],
  authors: [{ name: "Sonara Engineering" }],
  icons: {
    icon: "/favicon.ico",
  },
};

export const viewport: Viewport = {
  themeColor: "#8b5cf6",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

// Runs before first paint so the saved/system theme is applied with no flash.
const themeInitScript = `(function(){try{var t=localStorage.getItem('sonara-theme');if(t!=='light'&&t!=='dark'){t=window.matchMedia('(prefers-color-scheme: light)').matches?'light':'dark';}var d=document.documentElement;d.setAttribute('data-theme',t);d.classList.toggle('dark',t==='dark');}catch(e){}})();`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className={`${inter.variable} font-sans bg-background text-foreground antialiased`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
