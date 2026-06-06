"use client";

import { useEffect, useState } from "react";
import { apiCall } from "./api-client";

export type UserRole =
  | "admin" | "accounts" | "procurement" | "procurement-approver"
  | "estimation" | "hr" | "logistics" | "project-manager" | "engineer" | "viewer";

export function useRole() {
  const [role, setRole] = useState<UserRole | null>(null);
  const [uid, setUid] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await apiCall<{ role: UserRole; uid: string }>("/api/me");
        setRole(res.role);
        setUid(res.uid);
      } catch { setRole("viewer"); }
      finally { setLoading(false); }
    })();
  }, []);

  return {
    role, uid, loading,
    canWrite: role === "admin" || role === "accounts",
    canWriteAccounts: role === "admin" || role === "accounts",
    canWriteProcurement: role === "admin" || role === "procurement" || role === "procurement-approver",
    canApproveLpo: role === "procurement-approver",
    canWriteEstimation: role === "admin" || role === "estimation",
    canWriteLogistics: role === "admin" || role === "logistics",
    canWriteHR: role === "admin" || role === "hr",
    canWriteProjects: role === "admin" || role === "project-manager",
    canUpdateProgress: role === "admin" || role === "project-manager" || role === "engineer",
  };
}
