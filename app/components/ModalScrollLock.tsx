"use client";

import { useEffect } from "react";

const OVERLAY = ".fixed.inset-0";

const isModalBackdrop = (el: Element) => {
  const cls = el.getAttribute("class") ?? "";
  return /bg-(black|stone-900)\//.test(cls) && !cls.includes("md:hidden");
};

const touchesOverlay = (node: Node) =>
  node.nodeType === 1 && ((node as Element).matches(OVERLAY) || !!(node as Element).querySelector(OVERLAY));

export default function ModalScrollLock() {
  useEffect(() => {
    const root = document.documentElement;

    const sync = () => {
      const open = Array.from(document.body.querySelectorAll(OVERLAY)).some(isModalBackdrop);
      root.classList.toggle("modal-open", open);
    };

    const observer = new MutationObserver((mutations) => {
      const relevant = mutations.some(
        (m) => Array.from(m.addedNodes).some(touchesOverlay) || Array.from(m.removedNodes).some(touchesOverlay)
      );
      if (relevant) sync();
    });

    sync();
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      observer.disconnect();
      root.classList.remove("modal-open");
    };
  }, []);

  return null;
}
