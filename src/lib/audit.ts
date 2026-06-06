import { adminDb } from "./firebase-admin";
import { FieldValue } from "firebase-admin/firestore";

export type AuditAction =
  | "create" | "update" | "delete"
  | "approve" | "convert" | "login";

export async function logAudit(params: {
  userId: string;
  userEmail?: string | null;
  action: AuditAction;
  entityType: string;          // e.g. "lpo", "quotation", "invoice", "project"
  entityId: string;
  entityName?: string;         // human-readable: "LPO-1005" or project name
  details?: string;            // optional free-text description
}) {
  try {
    await adminDb.collection("auditLogs").add({
      ...params,
      timestamp: FieldValue.serverTimestamp(),
    });
  } catch (err) {
    // Audit failures must never block the actual operation
    console.error("Audit log failed:", err);
  }
}