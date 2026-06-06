import { adminDb } from "./firebase-admin";

const todayISO = () => new Date().toISOString().slice(0, 10);

/**
 * Rebuilds `employees.{employeeId}.assignedProjectIds` from the set of
 * currently-active assignments for that employee. Call after any
 * employeeAssignments write (create/update/delete) to keep the denormalized
 * mirror in sync. The field is read-only from the client's perspective —
 * this function is the only writer.
 */
export async function syncEmployeeProjectIds(employeeId: string): Promise<void> {
  const today = todayISO();
  const snap = await adminDb
    .collection("employeeAssignments")
    .where("employeeId", "==", employeeId)
    .get();

  const activeProjectIds = new Set<string>();
  snap.docs.forEach((doc) => {
    const data = doc.data();
    const start = data.startDate?.toDate?.()?.toISOString().slice(0, 10) || data.startDate;
    const end = data.endDate?.toDate?.()?.toISOString().slice(0, 10) || data.endDate || null;
    if (start <= today && (end === null || end >= today)) {
      if (data.projectId) activeProjectIds.add(data.projectId);
    }
  });

  await adminDb.collection("employees").doc(employeeId).set(
    { assignedProjectIds: Array.from(activeProjectIds) },
    { merge: true },
  );
}
