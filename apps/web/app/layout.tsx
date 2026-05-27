import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { Archivo, Archivo_Black, JetBrains_Mono } from "next/font/google";
import { ConvexClientProvider } from "./ConvexClientProvider";
import { Providers } from "./Providers";
import { SITE_URL } from "./_lib/urls";
import "./globals.css";

// Brutalist × Tumblr pairing: Archivo (grotesk) for UI/body, Archivo Black for
// heavy condensed display headlines, JetBrains Mono for metadata labels.
const archivo = Archivo({
  weight: ["500", "600", "700", "800", "900"],
  subsets: ["latin"],
  variable: "--font-archivo",
});

const archivoBlack = Archivo_Black({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-archivo-black",
});

const jetbrainsMono = JetBrains_Mono({
  weight: ["400", "500", "700"],
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
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
        className={`${archivo.variable} ${archivoBlack.variable} ${jetbrainsMono.variable} brutalism-light h-full antialiased`}
      >
        <body className="min-h-full flex flex-col bg-[color:var(--b-bg)] text-[color:var(--b-onbg)] font-sans">
          <Providers>
            <ConvexClientProvider>{children}</ConvexClientProvider>
          </Providers>
        </body>
      </html>
    </ClerkProvider>
  );
}
