import type { Metadata, Viewport } from "next";
import "./globals.css";
import { ServiceWorkerRegister } from "@/components/ServiceWorkerRegister";
import { InstallPrompt } from "@/components/InstallPrompt";
import { VersionWatcher } from "@/components/VersionWatcher";

export const metadata: Metadata = {
  title: "ThinkThru — The Learning Garden",
  description:
    "A Human Intent Network. Plant seeds, grow understanding together, bloom durable knowledge.",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "ThinkThru" },
  icons: {
    icon: [
      { url: "/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: "/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  // The browser-chrome colour (address bar / status bar) is set at runtime by
  // the inline script below so it matches the user's saved light/dark choice —
  // which lives in localStorage and can't be known by a static value here.
  themeColor: "#070D07",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        {/* Apply the saved theme before first paint so there's no flash of the
            wrong colours. */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "try{var l=localStorage.getItem('tt-theme')==='light';if(l)document.documentElement.classList.add('light');var m=document.querySelector('meta[name=\"theme-color\"]');if(m)m.setAttribute('content',l?'#f5f6f0':'#070D07');}catch(e){}",
          }}
        />
        {/*
          Fonts are loaded at runtime in the browser (not at build time) so the
          build never depends on outbound network access. System fonts are the
          fallback if Google Fonts is unreachable.
        */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,300;9..144,400;9..144,500&family=Inter:wght@300;400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="font-sans">
        <a href="#main" className="skip-link">
          Skip to main content
        </a>
        {children}
        <ServiceWorkerRegister />
        <VersionWatcher />
        <InstallPrompt />
      </body>
    </html>
  );
}
