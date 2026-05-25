import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { Share_Tech_Mono, Anton } from "next/font/google";
import { ConvexClientProvider } from "./ConvexClientProvider";
import { Providers } from "./Providers";
import { SITE_URL } from "./_lib/urls";
import "./globals.css";

// Brutalism theme fonts: Share Tech Mono for body, Anton for display headings.
const shareTechMono = Share_Tech_Mono({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-share-tech-mono",
});

const anton = Anton({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-anton",
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
        className={`${shareTechMono.variable} ${anton.variable} brutalism-light h-full antialiased`}
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
