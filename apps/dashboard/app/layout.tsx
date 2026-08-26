import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import SidebarNav from "./components/SidebarNav";
import MobileNav from "./components/MobileNav";
import TopBar from "./components/TopBar";
import CookieConsent from "./components/CookieConsent";
import { ToastProvider } from "./components/Toast";
import { SITE } from "../lib/site";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: "#4f46e5",
};

export const metadata: Metadata = {
  metadataBase: new URL(SITE.url),
  title: {
    default: "Lead Pipeline | LeadForge Intelligence",
    template: `%s | ${SITE.name}`,
  },
  description: SITE.description,
  applicationName: SITE.name,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={inter.variable}>
      <body className={`${inter.className} min-h-screen antialiased flex bg-background text-foreground`}>
        <ToastProvider>
          {/* Accessible Skip-to-content link */}
          <a href="#main-content" className="skip-to-content">
            Skip to main content
          </a>

          {/* Desktop Sidebar */}
          <SidebarNav />

          {/* Main Application Container */}
          <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
            {/* Top Navigation */}
            <TopBar />
            
            {/* Mobile Nav Drawer */}
            <MobileNav />

            {/* Main Content Area */}
            <main id="main-content" tabIndex={-1} className="flex-1 overflow-auto outline-none">
              {children}
            </main>
          </div>

          {/* Transparent Cookie Consent Banner */}
          <CookieConsent />
        </ToastProvider>
      </body>
    </html>
  );
}
