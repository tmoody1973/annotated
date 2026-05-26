import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { IBM_Plex_Sans, IBM_Plex_Mono, Newsreader } from "next/font/google";
import { ConvexClientProvider } from "./ConvexClientProvider";
import { Providers } from "./Providers";
import { SITE_URL } from "./_lib/urls";
import "./globals.css";

// Type-forward "news-app" pairing: IBM Plex Sans for UI, Newsreader (serif) for
// quotes + commentary, IBM Plex Mono scoped to timestamps.
const plexSans = IBM_Plex_Sans({
  weight: ["400", "500", "600"],
  subsets: ["latin"],
  variable: "--font-ibm-plex-sans",
});

const newsreader = Newsreader({
  weight: ["400", "500", "600"],
  subsets: ["latin"],
  variable: "--font-newsreader",
});

const plexMono = IBM_Plex_Mono({
  weight: ["400", "500"],
  subsets: ["latin"],
  variable: "--font-ibm-plex-mono",
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "Annotated",
  description: "Clip and annotate media from any web page.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider>
      <html
        lang="en"
        suppressHydrationWarning
        className={`${plexSans.variable} ${newsreader.variable} ${plexMono.variable} brutalism-light h-full antialiased`}
      >
        <body className="min-h-full flex flex-col bg-background text-foreground">
          <Providers>
            <ConvexClientProvider>{children}</ConvexClientProvider>
          </Providers>
        </body>
      </html>
    </ClerkProvider>
  );
}
