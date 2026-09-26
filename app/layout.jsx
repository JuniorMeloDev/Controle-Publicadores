import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

import { ServiceWorkerRegister } from "@/app/components/ServiceWorkerRegister";

export const metadata = {
  title: "Gestão Congregacional",
  description: "Sistema de gerenciamento congregacional",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Publicadores",
  },
  icons: {
    icon: "/favicon.ico",
    apple: "/icon-192.png",
  },
};

export const viewport = {
  themeColor: "#7c3aed",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }) {
  return (
    // Adicionamos a classe 'dark' ao HTML
    <html lang="pt-BR" className="dark">
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="Publicadores" />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased 
        bg-neutral-950 text-neutral-100`} // Fundo escuro e texto claro
      >
        <ServiceWorkerRegister />
        {children}
      </body>
    </html>
  );
}