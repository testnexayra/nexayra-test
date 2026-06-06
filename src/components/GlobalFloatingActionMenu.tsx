"use client";

import { usePathname } from "next/navigation";
import FloatingActionMenu from "./FloatingActionMenu";
import { getFabActions } from "@/lib/fab-config";

export default function GlobalFloatingActionMenu() {
  const pathname = usePathname();
  const actions = getFabActions(pathname || "");

  // No actions for this route → render nothing
  if (actions.length === 0) return null;

  return <FloatingActionMenu actions={actions} />;
}