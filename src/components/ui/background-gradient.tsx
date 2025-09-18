"use client";

import { cn } from "@/lib/utils";
import React from "react";

type BackgroundGradientProps = {
  children: React.ReactNode;
  className?: string;
  glowIntensity?: "subtle" | "strong";
};

// Simple gradient border wrapper inspired by aceternity-ui style
export function BackgroundGradient({ children, className, glowIntensity = "strong" }: BackgroundGradientProps) {
  const haloOpacity = glowIntensity === "strong" ? "opacity-80" : "opacity-40";
  const blur = glowIntensity === "strong" ? "blur-2xl" : "blur-xl";

  return (
    <div className="relative rounded-2xl">
      {/* Outer full glow halo */}
      <div
        aria-hidden
        className={cn(
          "pointer-events-none absolute -inset-3 rounded-[28px]",
          // dual radial glow for a fuller look
          "[background-image:radial-gradient(120%_80%_at_0%_0%,rgba(245,158,11,0.55),transparent_60%),radial-gradient(120%_80%_at_100%_100%,rgba(245,158,11,0.45),transparent_60%)]",
          haloOpacity,
          blur,
          "transition-opacity duration-300"
        )}
      />
      {/* Gradient border ring */}
      <div className="absolute inset-0 rounded-2xl p-[1.5px] bg-gradient-to-br from-amber-400/60 via-amber-300/20 to-transparent">
        <div className="h-full w-full rounded-[14px]" />
      </div>
      {/* Surface */}
      <div
        className={cn(
          "relative rounded-2xl border",
          "bg-white/95 border-black/5",
          "dark:bg-zinc-900/90 dark:border-white/10",
          "shadow-[0_8px_30px_rgb(0,0,0,0.12)]",
          className
        )}
      >
        {children}
      </div>
    </div>
  );
}


