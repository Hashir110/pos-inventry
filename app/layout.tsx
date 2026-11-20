import type { Metadata, Viewport } from "next";
import ToastProvider from "./components/ToastProvider";
import DialogProvider from "./components/DialogProvider";
import ModalScrollLock from "./components/ModalScrollLock";
import ServiceWorkerRegister from "./components/ServiceWorkerRegister";
import "./globals.css";

export const metadata: Metadata = {
  title: "ASAAN POS - Modern Retail Engine",
  description: "High-performance POS & Inventory Engine for Retailers.",
  manifest: "/manifest.json",
  icons: {
    icon: "/favicon.ico",
  },
};

export const viewport: Viewport = {
  themeColor: "#ea580c",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="font-sans antialiased text-on-surface bg-surface">
        <ToastProvider />
        <ModalScrollLock />
        <ServiceWorkerRegister />
        <DialogProvider>{children}</DialogProvider>
      </body>
    </html>
  );
}
