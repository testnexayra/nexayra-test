import { integrations, FILE_SIZE_LIMIT_BASE64, FILE_SIZE_LIMIT_DRIVE } from "./integrations";
import { google } from "googleapis";
import { Readable } from "stream";

export type UploadResult = {
  storage: "drive" | "firestore";
  driveFileId?: string;
  webViewLink?: string;
  base64?: string;
  mimeType: string;
  fileName: string;
  sizeBytes: number;
};

function getDriveClient() {
  const auth = new google.auth.JWT({
    email: integrations.drive.serviceAccountEmail,
    key: integrations.drive.privateKey,
    scopes: ["https://www.googleapis.com/auth/drive"],
    subject: integrations.drive.impersonateUser, // domain-wide delegation
  });
  return google.drive({ version: "v3", auth });
}

export async function uploadFile(params: {
  fileName: string;
  mimeType: string;
  base64Data: string;
  folderType: "vault" | "brand";
}): Promise<UploadResult> {
  const sizeBytes = Math.floor((params.base64Data.length * 3) / 4);

  if (integrations.drive.enabled) {
    if (sizeBytes > FILE_SIZE_LIMIT_DRIVE) {
      throw new Error(
        `File too large (${(sizeBytes / 1024 / 1024).toFixed(1)} MB). Max ${FILE_SIZE_LIMIT_DRIVE / 1024 / 1024} MB.`
      );
    }
    return await uploadToDrive(params);
  }

  // Firestore fallback
  if (sizeBytes > FILE_SIZE_LIMIT_BASE64) {
    throw new Error(
      `File too large (${(sizeBytes / 1024).toFixed(0)} KB). Max ${FILE_SIZE_LIMIT_BASE64 / 1024} KB until Google Drive is enabled. ` +
        `Set GOOGLE_DRIVE_ENABLED=true and configure service account env vars to upload larger files.`
    );
  }

  return {
    storage: "firestore",
    base64: params.base64Data,
    mimeType: params.mimeType,
    fileName: params.fileName,
    sizeBytes,
  };
}

async function uploadToDrive(params: {
  fileName: string;
  mimeType: string;
  base64Data: string;
  folderType: "vault" | "brand";
}): Promise<UploadResult> {
  const drive = getDriveClient();
  const folderId =
    params.folderType === "vault"
      ? integrations.drive.vaultFolderId
      : integrations.drive.brandFolderId;

  if (!folderId) {
    throw new Error(
      `Google Drive ${params.folderType} folder ID not configured. Set ${
        params.folderType === "vault" ? "GOOGLE_DRIVE_VAULT_FOLDER_ID" : "GOOGLE_DRIVE_BRAND_FOLDER_ID"
      } env var.`
    );
  }

  const buffer = Buffer.from(params.base64Data, "base64");
  const stream = Readable.from(buffer);

  const res = await drive.files.create({
    requestBody: { name: params.fileName, parents: [folderId] },
    media: { mimeType: params.mimeType, body: stream },
    fields: "id, webViewLink",
  });

  return {
    storage: "drive",
    driveFileId: res.data.id!,
    webViewLink: res.data.webViewLink!,
    mimeType: params.mimeType,
    fileName: params.fileName,
    sizeBytes: buffer.byteLength,
  };
}

export async function deleteFile(params: {
  storage: "drive" | "firestore";
  driveFileId?: string;
}): Promise<void> {
  if (params.storage === "firestore") return;
  if (!integrations.drive.enabled || !params.driveFileId) return;

  const drive = getDriveClient();
  await drive.files.delete({ fileId: params.driveFileId });
}