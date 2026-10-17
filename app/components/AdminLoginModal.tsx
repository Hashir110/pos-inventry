"use client";

import { useState } from "react";
import { Loader2, Lock, X } from "lucide-react";
import { toast } from "react-toastify";

interface AdminLoginModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function AdminLoginModal({ open, onClose, onSuccess }: AdminLoginModalProps) {
  const [password, setPassword] = useState("");
  const [checking, setChecking] = useState(false);

  if (!open) return null;

  const close = () => {
    setPassword("");
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setChecking(true);
    try {
      const res = await fetch("/api/admin-auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.ok) {
        setPassword("");
        onSuccess();
      } else {
        toast.error(data.error || "Password galat hai");
        setPassword("");
      }
    } catch {
      toast.error("Server se rabta nahi hua");
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[99] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <form onSubmit={handleSubmit} className="relative w-full max-w-sm rounded-2xl bg-white p-6 shadow-pop">
        <button
          type="button"
          onClick={close}
          className="absolute right-3 top-3 rounded-lg p-1.5 text-stone-400 hover:bg-stone-100 hover:text-stone-700"
        >
          <X size={20} />
        </button>

        <div className="mb-4 flex items-center gap-3">
          <span className="rounded-xl bg-violet-100 p-2.5 text-violet-700">
            <Lock size={20} />
          </span>
          <h3 className="text-lg font-extrabold text-stone-900">Admin Access</h3>
        </div>

        <input
          type="password"
          autoFocus
          autoComplete="off"
          className="field mb-4 text-center text-lg tracking-widest"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <button type="submit" disabled={checking || !password} className="btn-primary w-full !py-3">
          {checking ? <Loader2 className="animate-spin" size={18} /> : "Unlock"}
        </button>
      </form>
    </div>
  );
}
