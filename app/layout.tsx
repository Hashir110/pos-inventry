import type { Metadata, Viewport } from "next";
import ToastProvider from "./components/ToastProvider";
import ServiceWorkerRegister from "./components/ServiceWorkerRegister";
import { Nunito, Poppins } from "next/font/google";
import "./globals.css";

// Dreams POS jaisa: Nunito (body) + Poppins (headings, numbers)
const nunito = Nunito({
  variable: "--font-sans",
  subsets: ["latin"],
  display: "swap",
});

const poppins = Poppins({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "ASAAN POS Inventory Management",
  description: "Manage your inventory with ease using our ASAAN POS system.",
};

export const viewport: Viewport = {
  themeColor: "#fe9f43",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${nunito.variable} ${poppins.variable} font-sans antialiased`}>
        <ToastProvider />
        <ServiceWorkerRegister />
        {children}
      </body>
    </html>
  );
}
