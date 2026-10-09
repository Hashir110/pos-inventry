"use client";

import { useEffect } from "react";

// Offline ke liye pehle se cache hone wale pages
const WARM_ROUTES = [
  "/dashboard",
  "/dashboard/pos",
  "/dashboard/inventry",
  "/dashboard/inventry/add",
  "/dashboard/sales",
  "/dashboard/returns",
  "/dashboard/expenses",
  "/dashboard/settings",
];

/** Production mein service worker register karta hai (dev mein cache se confusion hoti hai) */
export default function ServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;

    (async () => {
      try {
        await navigator.serviceWorker.register("/sw.js");
        const registration = await navigator.serviceWorker.ready;
        if (navigator.onLine) {
          registration.active?.postMessage({ type: "WARM", urls: WARM_ROUTES });
        }
      } catch (error) {
        console.error("Service worker register nahi hua:", error);
      }
    })();
  }, []);

  return null;
}
