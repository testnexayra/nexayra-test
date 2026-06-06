"use client";

import {
  FolderPlus, Camera, AlertTriangle,
  FileText, Receipt, ShoppingCart,
  Users, UserPlus, Truck,
  Megaphone, Banknote, ClipboardList,
} from "lucide-react";
import type { FABAction } from "@/components/FloatingActionMenu";

// Map a URL prefix to a set of actions. The first matching prefix wins.
// Longer prefixes should come FIRST (more specific routes match before generic).
type FabRule = {
  prefix: string;
  actions: FABAction[];
};

export const FAB_RULES: FabRule[] = [
  // ---- PROJECTS ----
  {
    prefix: "/dashboard/projects",
    actions: [
      { icon: FolderPlus,    label: "Create New Project",      href: "/dashboard/projects/new" },
      { icon: Camera,        label: "Log Site Progress Photo", onClick: () => alert("Coming soon.") },
      { icon: AlertTriangle, label: "Report Site Issue/Delay", onClick: () => alert("Coming soon.") },
    ],
  },

  // ---- PROCUREMENT (LPOs) ----
  {
    prefix: "/dashboard/procurement",
    actions: [
      { icon: ShoppingCart, label: "Create New LPO", href: "/dashboard/procurement/lpo" },
    ],
  },

  // ---- ESTIMATION (Quotations) ----
  {
    prefix: "/dashboard/estimation",
    actions: [
      { icon: FileText, label: "Create New Quotation", href: "/dashboard/estimation/quotation" },
    ],
  },

  // ---- ACCOUNTS ----
  {
    prefix: "/dashboard/accounts",
    actions: [
      { icon: Receipt,    label: "Create Tax Invoice",   href: "/dashboard/accounts/tax-invoice" },
      { icon: Banknote, label: "Record Project Expense", href: "/dashboard/accounts/project-expenses" },
    ],
  },

  // ---- HR ----
  {
    prefix: "/dashboard/hr",
    actions: [
      { icon: UserPlus, label: "Add Employee",        href: "/dashboard/hr/employees/new" },
      { icon: Users,    label: "View All Employees", href: "/dashboard/hr/employees" },
    ],
  },

  // ---- TRANSPORTATION ----
  {
    prefix: "/dashboard/transportation",
    actions: [
      { icon: Truck, label: "Log Trip",       onClick: () => alert("Coming soon.") },
      { icon: ClipboardList, label: "Vehicle Inspection", onClick: () => alert("Coming soon.") },
    ],
  },

  // ---- MARKETING ----
  {
    prefix: "/dashboard/marketing",
    actions: [
      { icon: Megaphone, label: "New Marketing Post", onClick: () => alert("Coming soon.") },
    ],
  },

  // ---- COMPANY OVERVIEW (dashboard home) ----
  {
    prefix: "/dashboard",
    actions: [
      { icon: FolderPlus, label: "Create New Project", href: "/dashboard/projects/new" },
      { icon: FileText,   label: "Create Quotation",   href: "/dashboard/estimation/quotation" },
      { icon: Receipt,    label: "Create Tax Invoice", href: "/dashboard/accounts/tax-invoice" },
    ],
  },
];

// Returns the actions for a given path, falling back to the last (most generic) rule
export function getFabActions(pathname: string): FABAction[] {
  for (const rule of FAB_RULES) {
    if (pathname.startsWith(rule.prefix)) return rule.actions;
  }
  return [];
}