import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "sonner";
import { ThemeProvider } from "@/components/theme-provider";
import { BuyNowFAB } from "@/components/ui/BuyNowFAB";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "SupaStart - The Ultimate SaaS Starter Kit",
    template: "%s | SupaStart"
  },
  description: "Launch your SaaS faster with SupaStart - a complete Next.js starter kit with authentication, payments, database, and deployment ready out of the box.",
  keywords: ["SaaS", "starter kit", "Next.js", "Supabase", "TypeScript", "Tailwind CSS", "authentication", "payments", "Stripe"],
  authors: [{ name: "SupaStart Team" }],
  creator: "SupaStart",
  publisher: "SupaStart",
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'https://supastart.com'),
  alternates: {
    canonical: '/',
  },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: '/',
    title: 'SupaStart - The Ultimate SaaS Starter Kit',
    description: 'Launch your SaaS faster with SupaStart - a complete Next.js starter kit with authentication, payments, database, and deployment ready out of the box.',
    siteName: 'SupaStart',
    images: [
      {
        url: '/hero-section-screenshot.png',
        width: 1200,
        height: 630,
        alt: 'SupaStart - SaaS Starter Kit Dashboard',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'SupaStart - The Ultimate SaaS Starter Kit',
    description: 'Launch your SaaS faster with SupaStart - a complete Next.js starter kit with authentication, payments, database, and deployment ready out of the box.',
    images: ['/hero-section-screenshot.png'],
    creator: '@supastart',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  icons: {
    icon: '/favicon.ico',
    shortcut: '/favicon.ico',
    apple: '/favicon.ico',
  },
  manifest: '/manifest.json',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {children}
          <BuyNowFAB />
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
