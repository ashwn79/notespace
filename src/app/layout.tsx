import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import "katex/dist/katex.min.css";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Notespace — Premium Writing Experience",
  description:
    "Notespace is a Notion-inspired, block-based workspace for writing: slash commands, drag & drop, code highlighting, tables, math, columns and autosave.",
  keywords: ["notespace", "notes", "rich text editor", "notion", "wysiwyg", "block editor", "tiptap"],
  applicationName: "Notespace",
  // Favicon / Apple touch icon come from src/app/icon.png + apple-icon.png
  // (file-convention metadata) — the Notespace mark itself.
  appleWebApp: {
    capable: true,
    title: "Notespace",
    statusBarStyle: "black-translucent",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0c" },
    { media: "(prefers-color-scheme: light)", color: "#fafafa" },
  ],
  width: "device-width",
  initialScale: 1,
  // Cover the notch/home-indicator area so env(safe-area-inset-*) works —
  // the mobile dock and status bar rely on it.
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${inter.variable} ${jetbrainsMono.variable} antialiased bg-background text-foreground font-sans`}
      >
        <ThemeProvider>
          {children}
          <Toaster position="bottom-right" richColors />
        </ThemeProvider>
      </body>
    </html>
  );
}
