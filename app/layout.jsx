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

export const metadata = {
  title: "Gestão Congregacional",
  description: "Sistema de gerenciamento congregacional",
};

export default function RootLayout({ children }) {
  return (
    // Adicionamos a classe 'dark' ao HTML
    <html lang="pt-BR" className="dark">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased 
        bg-neutral-950 text-neutral-100`} // Fundo escuro e texto claro
      >
        {children}
      </body>
    </html>
  );
}