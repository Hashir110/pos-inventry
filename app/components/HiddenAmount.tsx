"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { useLanguage } from "../store/useLanguage";

interface HiddenAmountProps {
    value: string;
    className?: string;
    iconSize?: number;
}

export default function HiddenAmount({ value, className = "", iconSize = 16 }: HiddenAmountProps) {
    const { t } = useLanguage();
    const [visible, setVisible] = useState(false);

    return (
        <span className="inline-flex items-center gap-2">
            <span className={className}>{visible ? value : "••••"}</span>
            <button
                type="button"
                onClick={() => setVisible((v) => !v)}
                className="text-stone-400 hover:text-stone-700"
                title={visible ? t("shared_hide") : t("shared_show")}
            >
                {visible ? <Eye size={iconSize} /> : <EyeOff size={iconSize} />}
            </button>
        </span>
    );
}
