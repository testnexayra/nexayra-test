import { adminDb } from "./firebase-admin";
import { FieldValue, Timestamp } from "firebase-admin/firestore";

export interface LedgerEntry {
  bankAccountId: string;
  amount: number; // positive = credit/money in, negative = debit/money out
  date: string; // ISO date
  type: "expense" | "project-expense" | "collection" | "partner-contribution" | "partner-withdrawal" | "partner-distribution" | "opening" | "adjustment" | "petty-cash-allocation" | "petty-cash-reimbursement";
  source: string; // collection name this came from
  sourceId: string; // doc id of the source
  description: string;
  createdBy?: string;
}

export async function writeLedgerEntry(entry: LedgerEntry): Promise<string> {
  const docRef = await adminDb.collection("bankTransactions").add({
    ...entry,
    date: Timestamp.fromDate(new Date(entry.date)),
    createdAt: FieldValue.serverTimestamp(),
  });
  return docRef.id;
}

export async function reverseLedgerBySource(source: string, sourceId: string): Promise<void> {
  const snap = await adminDb.collection("bankTransactions")
    .where("source", "==", source)
    .where("sourceId", "==", sourceId)
    .get();
  const batch = adminDb.batch();
  snap.docs.forEach((d: any) => batch.delete(d.ref));
  await batch.commit();
}