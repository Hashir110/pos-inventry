import type { KeyboardEvent } from "react";

export const onEnter =
  (action: () => void) =>
  (e: KeyboardEvent<HTMLElement>) => {
    if (e.key !== "Enter" || e.defaultPrevented || e.nativeEvent.isComposing) return;
    const target = e.target as HTMLElement;
    if (target.tagName !== "INPUT") return;
    const type = (target as HTMLInputElement).type;
    if (type === "button" || type === "submit" || type === "checkbox" || type === "radio") return;
    e.preventDefault();
    action();
  };
