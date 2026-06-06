"use client";

import { auth } from "@/lib/firebase";
import { capitalize } from "@/lib/format";
import { useEffect, useState } from "react";

type WelcomeBannerProps = {
  tagline: string;
  showName?: boolean;
  compact?: boolean;
};

export default function WelcomeBanner({ tagline, showName = true, compact = false }: WelcomeBannerProps) {
  const [name, setName] = useState("there");

  useEffect(() => {
    const email = auth.currentUser?.email || "";
    const prefix = email.split("@")[0];
    setName(capitalize(prefix));
  }, []);

  return (
    <div
      className={`relative rounded-2xl ${
        compact ? "p-5 mb-4" : "p-8 mb-6"
      } text-white overflow-hidden animate-fade-in-up shadow-md`}
      style={{
        // Hardcoded — stays the SAME in light AND dark mode
        background: "linear-gradient(135deg, #192A56 0%, #0F1B3D 100%)",
      }}
    >
      {/* Decorative orbs */}
      <div className="absolute -top-20 -right-20 w-64 h-64 bg-white/5 rounded-full pointer-events-none blur-2xl" />
      <div className="absolute -bottom-16 left-1/3 w-48 h-48 rounded-full pointer-events-none blur-2xl" style={{ background: "rgba(198, 163, 94, 0.15)" }} />

      {/* Subtle grid pattern overlay for texture */}
      <div
        className="absolute inset-0 opacity-[0.04] pointer-events-none"
        style={{
          backgroundImage: "radial-gradient(circle at 1px 1px, white 1px, transparent 0)",
          backgroundSize: "32px 32px",
        }}
      />

      <div className="relative z-10">
        {showName && (
          <h1 className={`font-display font-bold mb-2 ${compact ? "text-2xl" : "text-3xl"}`}>
            Welcome back, {name}!
          </h1>
        )}
        <p className="text-white/70 max-w-2xl text-sm md:text-base leading-relaxed">{tagline}</p>
      </div>
    </div>
  );
}