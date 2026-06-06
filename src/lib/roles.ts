import { adminDb } from "./firebase-admin";

export type UserRole =
  | "admin"
  | "accounts"
  | "procurement"
  | "procurement-approver"
  | "estimation"
  | "hr"
  | "logistics"
  | "project-manager"
  | "engineer"
  | "viewer";

export async function getUserRole(uid: string): Promise<UserRole> {
  const doc = await adminDb.collection("users").doc(uid).get();
  if (!doc.exists) return "viewer";
  return (doc.data()?.role || "viewer") as UserRole;
}

export function canWriteAccounts(role: UserRole): boolean { return role === "admin" || role === "accounts"; }
export function canWriteProcurement(role: UserRole): boolean { return role === "admin" || role === "procurement" || role === "procurement-approver"; }
export function canApproveLpo(role: UserRole): boolean { return role === "admin" || role === "procurement-approver"; }
export function canWriteEstimation(role: UserRole): boolean { return role === "admin" || role === "estimation"; }
export function canWriteHR(role: UserRole): boolean { return role === "admin" || role === "hr"; }
export function canWriteLogistics(role: UserRole): boolean { return role === "admin" || role === "logistics"; }
export function canWriteProjects(role: UserRole): boolean { return role === "admin" || role === "project-manager"; }
export function canUpdateProjectProgress(role: UserRole): boolean { return role === "admin" || role === "project-manager" || role === "engineer"; }