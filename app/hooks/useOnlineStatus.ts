import { useSyncExternalStore } from "react";

const subscribe = (callback: () => void) => {
  window.addEventListener("online", callback);
  window.addEventListener("offline", callback);
  return () => {
    window.removeEventListener("online", callback);
    window.removeEventListener("offline", callback);
  };
};

/** Browser online hai ya offline. Server render par hamesha true. */
export const useOnlineStatus = (): boolean =>
  useSyncExternalStore(
    subscribe,
    () => navigator.onLine,
    () => true
  );
