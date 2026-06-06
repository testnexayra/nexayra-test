"use client";

import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { Plus } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type FABAction = {
  icon: LucideIcon;
  label: string;
  href?: string;
  onClick?: () => void;
};

type FloatingActionMenuProps = {
  actions: FABAction[];
};

export default function FloatingActionMenu({ actions }: FloatingActionMenuProps) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Portal needs to wait for client-side mount (avoid SSR mismatch)
  useEffect(() => {
    setMounted(true);
  }, []);

  // Close when clicking outside
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  if (!mounted) return null;

  const menu = (
    <div
      ref={containerRef}
      style={{
        position: "fixed",
        bottom: "24px",
        right: "24px",
        zIndex: 9999,
      }}
      className="flex flex-col items-end gap-3"
    >
      {/* Action buttons — slide up when open */}
      {open && (
        <div className="flex flex-col items-end gap-3 animate-fade-in-up">
          {actions.map((action, i) => {
            const Icon = action.icon;
            const Wrapper: any = action.href ? Link : "button";
            const wrapperProps: any = action.href
              ? { href: action.href }
              : { onClick: () => { action.onClick?.(); setOpen(false); }, type: "button" };
            return (
              <div key={i} className="group flex items-center gap-3" style={{ animationDelay: `${i * 0.04}s` }}>
                <span className="bg-navy text-white text-xs font-bold dark:text-navy-700 px-3 py-1.5 rounded-lg shadow-md opacity-0 group-hover:opacity-100 translate-x-2 group-hover:translate-x-0 transition-all duration-200 whitespace-nowrap pointer-events-none">
                  {action.label}
                </span>
                <Wrapper
                  {...wrapperProps}
                  className="w-12 h-12 rounded-full bg-blue-600 hover:bg-[#C6A35E] flex items-center justify-center shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-110 active:scale-95"
                  aria-label={action.label}
                  title={action.label}
                >
                  <Icon size={20} className="text-white transition-colors" />
                </Wrapper>
              </div>
            );
          })}
        </div>
      )}

      {/* Main toggle button */}
      <button
        onClick={() => setOpen(!open)}
        className={`w-14 h-14 rounded-full shadow-lg hover:shadow-2xl flex items-center justify-center transition-all duration-300 hover:scale-110 active:scale-95 ${
          open
            ? "bg-[#C6A35E] rotate-45"
            : "bg-blue-600 hover:bg-[#C6A35E]"
        }`}
        aria-label={open ? "Close menu" : "Open quick actions"}
      >
        <Plus size={26} className="text-white" />
      </button>
    </div>
  );

  // Portal directly to body — escapes any transformed/filtered parent
  return createPortal(menu, document.body);
}