"use client";

import { useEffect, useState } from "react";
import Image from "next/image";

const CAPTIONS = [
  "Building something extraordinary…",
  "Aligning the blueprints…",
  "Polishing every pixel for you…",
  "Mixing the perfect blend of data…",
  "Channeling some Nexayra magic…",
  "Just a moment of greatness…",
  "Sharpening the details…",
  "Crafting your view…",
  "Loading what you came for…",
  "Setting the stage…",
  "Almost there — promise it's worth it…",
  "Spinning up the engine room…",
  "Calibrating excellence…",
  "Lining up the bricks…",
  "Tightening every bolt…",
];

function pickCaption(): string {
  return CAPTIONS[Math.floor(Math.random() * CAPTIONS.length)];
}

type LoaderProps = {
  /** Full-screen overlay. Use for initial page loads. */
  fullScreen?: boolean;
  /** Override caption with custom text. */
  message?: string;
  /** Smaller compact variant for inline use within sections. */
  compact?: boolean;
};

export default function Loader({ fullScreen = false, message, compact = false }: LoaderProps) {
  const [caption, setCaption] = useState(message || CAPTIONS[0]);

  useEffect(() => {
    if (message) {
      setCaption(message);
      return;
    }

    const id = setInterval(() => setCaption(pickCaption()), 2200);
    return () => clearInterval(id);
  }, [message]);

  const logoSize = compact ? 48 : 80;
  const containerClasses = fullScreen
    ? "fixed inset-0 z-[100] flex flex-col items-center justify-center bg-bg/95 backdrop-blur-sm"
    : compact
      ? "flex flex-col items-center justify-center py-8"
      : "flex flex-col items-center justify-center py-16";

  return (
    <div className={containerClasses}>
      <div className="animate-logo-pulse">
        {/* Logo — falls back to text mark if image fails */}
        <Image
          src="/nexayra.png"
          alt="Nexayra Arc"
          width={logoSize}
          height={logoSize}
          priority
          className="select-none drop-shadow-md"
          onError={(e) => {
            // Fallback: hide image, show text mark
            (e.target as HTMLImageElement).style.display = "none";
          }}
        />
      </div>

      {/* Text mark — visible if logo fails to load */}
      <div
        className={`font-display font-bold text-navy ${compact ? "text-sm mt-2" : "text-xl mt-4"}`}
        style={{ display: "none" }}
        id="nx-loader-textmark"
      >
        Nexayra <span className="text-gold">Arc</span>
      </div>

      <p
        key={caption}
        className={`text-navy-400 mt-4 font-medium animate-fade-in ${compact ? "text-xs" : "text-sm"}`}
      >
        {caption}
      </p>
    </div>
  );
}

/**
 * Inline mini loader for buttons / small UI areas — just the pulsing logo, no caption.
 */
export function MiniLoader({ size = 24 }: { size?: number }) {
  return (
    <div className="inline-flex items-center justify-center">
      <div className="animate-logo-pulse">
        <Image
          src="/nexayra/logo.png"
          alt="Loading"
          width={size}
          height={size}
          priority
          className="select-none"
        />
      </div>
    </div>
  );
}
