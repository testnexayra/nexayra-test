import { adminDb } from "./firebase-admin";
import { FieldValue } from "firebase-admin/firestore";

// Create a revision of a document by copying it to a new doc with "Rev N" suffix.
// Returns new document number string.
export async function createRevision(
  collection: string,
  originalDocId: string,
  numberField: string, // e.g., "quotationNo", "invoiceNo", "documentNo"; for LPO use "nxrNo"
  updates: Record<string, any>,
  createdBy: string
): Promise<string> {
  const origSnap = await adminDb.collection(collection).doc(originalDocId).get();
  if (!origSnap.exists) throw new Error("Original document not found");
  const orig = origSnap.data()!;

  // Figure out base number and next revision
  const originalNumber = String(orig[numberField] ?? "");
  const baseNumber = originalNumber.replace(/\s*Rev\s*\d+$/i, "");
  const rootDocIdBase = originalDocId.replace(/_Rev_\d+$/i, "");

  // Find highest revision so far
  const snap = await adminDb.collection(collection).get();
  let maxRev = 0;
  snap.docs.forEach(d => {
    const n = String(d.data()?.[numberField] ?? "");
    if (n === baseNumber) return; // original (Rev 0 implicit)
    const m = n.match(/^(.+?)\s*Rev\s*(\d+)$/i);
    if (m && m[1].trim() === baseNumber.trim()) {
      const r = Number(m[2]);
      if (r > maxRev) maxRev = r;
    }
  });
  const nextRev = maxRev + 1;
  const newNumber = `${baseNumber} Rev ${nextRev}`;
  const newDocId = `${rootDocIdBase}_Rev_${nextRev}`;

  const newData = {
    ...orig,
    ...updates,
    [numberField]: numberField === "nxrNo" ? newNumber : newNumber, // number stays a string for Rev versions
    revisionOf: rootDocIdBase,
    revisionNumber: nextRev,
    createdBy,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  };

  await adminDb.collection(collection).doc(newDocId).set(newData);
  return newNumber;
}