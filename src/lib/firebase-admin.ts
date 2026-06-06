import { initializeApp, getApps, cert, type App } from "firebase-admin/app";
import { getAuth, type Auth } from "firebase-admin/auth";
import { getFirestore, type Firestore } from "firebase-admin/firestore";

let app: App | null = null;
let adminAuthInstance: Auth | null = null;
let adminDbInstance: Firestore | null = null;
let initError: string | null = null;

function initAdmin() {
  if (app) return;
  if (getApps().length > 0) {
    app = getApps()[0];
    adminAuthInstance = getAuth(app);
    adminDbInstance = getFirestore(app);
    return;
  }

  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  let privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY;

  const missing: string[] = [];
  if (!projectId) missing.push("FIREBASE_ADMIN_PROJECT_ID");
  if (!clientEmail) missing.push("FIREBASE_ADMIN_CLIENT_EMAIL");
  if (!privateKey) missing.push("FIREBASE_ADMIN_PRIVATE_KEY");

  if (missing.length > 0) {
    initError = `Missing env vars: ${missing.join(", ")}`;
    console.error("🔥 Firebase Admin init failed:", initError);
    return;
  }

  // Handle \n in private key (Windows .env quirk, Vercel, etc.)
  if (privateKey && privateKey.includes("\\n")) {
    privateKey = privateKey.replace(/\\n/g, "\n");
  }
  // Strip surrounding quotes if present
  if (privateKey && (privateKey.startsWith('"') || privateKey.startsWith("'"))) {
    privateKey = privateKey.slice(1, -1).replace(/\\n/g, "\n");
  }

  try {
    app = initializeApp({
      credential: cert({ projectId, clientEmail, privateKey }),
    });
    adminAuthInstance = getAuth(app);
    adminDbInstance = getFirestore(app);
    console.log("✅ Firebase Admin initialized");
  } catch (err: any) {
    initError = err.message || "Unknown init error";
    console.error("🔥 Firebase Admin init failed:", initError);
  }
}

initAdmin();

export const adminAuth = new Proxy({} as Auth, {
  get(_t, prop) {
    if (!adminAuthInstance) {
      throw new Error(`Firebase Admin Auth not initialized. ${initError || "Check your environment variables."}`);
    }
    return (adminAuthInstance as any)[prop];
  },
});

export const adminDb = new Proxy({} as Firestore, {
  get(_t, prop) {
    if (!adminDbInstance) {
      throw new Error(`Firebase Admin Firestore not initialized. ${initError || "Check your environment variables."}`);
    }
    return (adminDbInstance as any)[prop];
  },
});