"use client";

import { Loader2 } from "lucide-react";

export default function LoadingOverlay({
  title = "Analyzing Repository",
  subtitle = "Reading project structure and drafting a polished README...",
  show = false,
}: {
  title?: string;
  subtitle?: string;
  show: boolean;
}) {
  if (!show) return null;
  return (
    <div className="loading-overlay">
      <div className="loading-card">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full border border-white/15 bg-black/40">
          <Loader2 className="h-5 w-5 animate-spin text-indigo-300" />
        </div>
        <div className="text-lg font-semibold text-white">{title}</div>
        <div className="mt-1 text-white/70">{subtitle}</div>
        <div className="mt-4 text-white/50 text-sm dots" aria-hidden />
      </div>
    </div>
  );
}