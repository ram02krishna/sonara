"use client";

import React from "react";
import { CheckCircle2, AlertCircle, Info, X } from "lucide-react";
import { useAppStore } from "@/store/useAppStore";
import { cn } from "@/lib/utils";

export function ToastContainer() {
  const { toasts, removeToast } = useAppStore();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-5 right-5 z-50 flex flex-col gap-2.5 max-w-sm w-full pointer-events-none">
      {toasts.map((toast) => {
        let Icon = Info;
        let iconColor = "text-cyan-400";

        if (toast.type === "success") {
          Icon = CheckCircle2;
          iconColor = "text-emerald-400";
        } else if (toast.type === "error") {
          Icon = AlertCircle;
          iconColor = "text-rose-400";
        }

        return (
          <div
            key={toast.id}
            className="pointer-events-auto glass-panel border border-white/10 rounded-2xl p-3.5 shadow-xl flex items-start gap-3 backdrop-blur-xl animate-in fade-in slide-in-from-top-2 duration-200"
          >
            <Icon className={cn("w-5 h-5 shrink-0 mt-0.5", iconColor)} />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-white">{toast.title}</p>
              {toast.description && (
                <p className="text-[11px] text-muted-foreground mt-0.5">{toast.description}</p>
              )}
            </div>
            <button
              onClick={() => removeToast(toast.id)}
              className="p-1 rounded-md hover:bg-white/10 text-muted-foreground hover:text-white transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
