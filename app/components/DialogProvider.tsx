"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { AlertTriangle, HelpCircle, X } from "lucide-react";
import { useLanguage } from "../store/useLanguage";

type Tone = "danger" | "brand";

interface ConfirmOptions {
  title: string;
  message?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: Tone;
  requireText?: string;
}

interface NumberOptions {
  title: string;
  message?: ReactNode;
  max?: number;
  min?: number;
  defaultValue?: number;
  unit?: string;
  confirmLabel?: string;
  placeholder?: string;
}

interface DialogApi {
  confirm: (options: ConfirmOptions) => Promise<boolean>;
  promptNumber: (options: NumberOptions) => Promise<number | null>;
}

type ActiveDialog =
  | { kind: "confirm"; options: ConfirmOptions; resolve: (value: boolean) => void }
  | { kind: "number"; options: NumberOptions; resolve: (value: number | null) => void };

const DialogContext = createContext<DialogApi | null>(null);

export const useDialog = (): DialogApi => {
  const ctx = useContext(DialogContext);
  if (!ctx) throw new Error("useDialog can only be used inside DialogProvider");
  return ctx;
};

const TONES = {
  danger: { icon: "bg-red-100 text-red-600", button: "!bg-red-600 hover:!bg-red-700", ring: "focus:!border-red-500 focus:!ring-red-500/10" },
  brand: { icon: "bg-brand-100 text-brand-700", button: "", ring: "" },
} as const;

export default function DialogProvider({ children }: { children: ReactNode }) {
  const { t } = useLanguage();
  const [dialog, setDialog] = useState<ActiveDialog | null>(null);
  const [typed, setTyped] = useState("");
  const [numberValue, setNumberValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const confirm = useCallback(
    (options: ConfirmOptions) =>
      new Promise<boolean>((resolve) => {
        setTyped("");
        setDialog({ kind: "confirm", options, resolve });
      }),
    []
  );

  const promptNumber = useCallback(
    (options: NumberOptions) =>
      new Promise<number | null>((resolve) => {
        setNumberValue(options.defaultValue !== undefined ? String(options.defaultValue) : "");
        setDialog({ kind: "number", options, resolve });
      }),
    []
  );

  const close = useCallback(
    (result: boolean | number | null) => {
      if (!dialog) return;
      if (dialog.kind === "confirm") dialog.resolve(result === true);
      else dialog.resolve(typeof result === "number" ? result : null);
      setDialog(null);
    },
    [dialog]
  );

  useEffect(() => {
    if (!dialog) return;
    const timer = setTimeout(() => inputRef.current?.focus(), 60);
    return () => clearTimeout(timer);
  }, [dialog]);

  const tone: Tone = dialog?.kind === "confirm" ? dialog.options.tone ?? "danger" : "brand";
  const styles = TONES[tone];

  const numberInvalid = (() => {
    if (dialog?.kind !== "number") return false;
    const n = parseFloat(numberValue);
    const { min, max } = dialog.options;
    return isNaN(n) || n <= 0 || (min !== undefined && n < min) || (max !== undefined && n > max);
  })();

  const confirmDisabled =
    (dialog?.kind === "confirm" && !!dialog.options.requireText && typed.trim() !== dialog.options.requireText) ||
    (dialog?.kind === "number" && numberInvalid);

  const submit = () => {
    if (!dialog || confirmDisabled) return;
    if (dialog.kind === "confirm") close(true);
    else close(parseFloat(numberValue));
  };

  return (
    <DialogContext.Provider value={{ confirm, promptNumber }}>
      {children}

      {dialog && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-stone-900/50 p-4 backdrop-blur-sm animate-in fade-in">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              submit();
            }}
            role="dialog"
            aria-modal="true"
            className="relative w-full max-w-sm overflow-hidden rounded-2xl bg-white shadow-pop animate-in zoom-in-95"
          >
            <button
              type="button"
              onClick={() => close(dialog.kind === "confirm" ? false : null)}
              className="absolute right-3 top-3 rounded-lg p-1.5 text-stone-400 hover:bg-stone-100 hover:text-stone-700"
            >
              <X size={20} />
            </button>
            <div className="flex flex-col items-center px-6 pb-2 pt-7 text-center">
              <span className={`mb-4 flex h-14 w-14 items-center justify-center rounded-full ${styles.icon}`}>
                {dialog.kind === "confirm" && tone === "danger" ? <AlertTriangle size={26} /> : <HelpCircle size={26} />}
              </span>
              <h3 className="text-lg font-extrabold text-stone-900">{dialog.options.title}</h3>
              {dialog.options.message && <p className="mt-1.5 text-sm leading-relaxed text-stone-500">{dialog.options.message}</p>}

              {dialog.kind === "confirm" && dialog.options.requireText && (
                <div className="mt-4 w-full">
                  <p className="mb-1.5 text-xs font-semibold text-stone-500">
                    {t("shared_typeToConfirm", { text: dialog.options.requireText })}
                  </p>
                  <input
                    ref={inputRef}
                    value={typed}
                    onChange={(e) => setTyped(e.target.value)}
                    className={`field text-center font-bold ${styles.ring}`}
                    autoComplete="off"
                  />
                </div>
              )}

              {dialog.kind === "number" && (
                <div className="mt-4 w-full">
                  <div className="relative">
                    <input
                      ref={inputRef}
                      type="number"
                      step="any"
                      min={dialog.options.min ?? 0}
                      max={dialog.options.max}
                      value={numberValue}
                      placeholder={dialog.options.placeholder ?? "0"}
                      onChange={(e) => setNumberValue(e.target.value)}
                      className="field text-center text-2xl font-bold"
                    />
                    {dialog.options.unit && (
                      <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-sm font-bold text-stone-400">
                        {dialog.options.unit}
                      </span>
                    )}
                  </div>
                  {dialog.options.max !== undefined && (
                    <p className="mt-1.5 text-xs text-stone-400">{t("shared_maximum", { max: dialog.options.max })}</p>
                  )}
                </div>
              )}
            </div>

            <div className="flex gap-3 px-6 pb-6 pt-5">
              <button type="button" onClick={() => close(dialog.kind === "confirm" ? false : null)} className="btn-ghost flex-1">
                {(dialog.kind === "confirm" && dialog.options.cancelLabel) || t("cancel")}
              </button>
              <button type="submit" disabled={confirmDisabled} className={`btn-primary flex-1 ${styles.button}`}>
                {dialog.options.confirmLabel || (dialog.kind === "confirm" ? t("shared_confirm") : t("shared_ok"))}
              </button>
            </div>
          </form>
        </div>
      )}
    </DialogContext.Provider>
  );
}
