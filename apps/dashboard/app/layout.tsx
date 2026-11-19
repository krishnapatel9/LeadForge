import type { Metadata, Viewport } from "next";
import "./globals.css";
import Header from "./components/Header";
import CookieConsent from "./components/CookieConsent";
import { ToastProvider } from "./components/Toast";
import { SITE } from "../lib/site";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: "#000000",
  viewportFit: "cover",
};

export const metadata: Metadata = {
  metadataBase: new URL(SITE.url),
  title: {
    default: "LeadForge",
    template: `%s | LeadForge`,
  },
  description: SITE.description,
  applicationName: "LeadForge",
  icons: {
    icon: "/icon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem("lf-theme");if(t){document.documentElement.dataset.theme=t;}}catch(e){}})()`,
          }}
        />
      </head>
      <body>
        <ToastProvider>
          {/* Accessible Skip-to-content link */}
          <a href="#main-content" className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:p-2 focus:bg-black focus:text-white">
            Skip to main content
          </a>

          {/* Prototype Top Navigation Header */}
          <Header />

          {/* Main Application Container */}
          <main id="main-content" className="app-main" tabIndex={-1}>
            {children}
          </main>

          {/* Toast Notification Container element */}
          <div id="toast" role="status" aria-live="polite"></div>

          {/* Transparent Cookie Consent Banner */}
          <CookieConsent />
        </ToastProvider>
      </body>
    </html>
  );
}
