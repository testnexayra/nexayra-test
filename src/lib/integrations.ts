// Feature flags — controlled by env vars. Default: scaffolded mode.
export const integrations = {
  drive: {
    enabled: process.env.GOOGLE_DRIVE_ENABLED === "true",
    serviceAccountEmail: process.env.GOOGLE_DRIVE_SERVICE_ACCOUNT_EMAIL || "",
    privateKey: (process.env.GOOGLE_DRIVE_PRIVATE_KEY || "").replace(/\\n/g, "\n"),
    impersonateUser: process.env.GOOGLE_DRIVE_IMPERSONATE_USER || "nexayraarc@gmail.com",
    vaultFolderId: process.env.GOOGLE_DRIVE_VAULT_FOLDER_ID || "",
    brandFolderId: process.env.GOOGLE_DRIVE_BRAND_FOLDER_ID || "",
  },
  gemini: {
    enabled: process.env.GEMINI_ENABLED === "true",
    apiKey: process.env.GEMINI_API_KEY || "",
    model: process.env.GEMINI_MODEL || "gemini-2.0-flash",
  },
};

export const FILE_SIZE_LIMIT_BASE64 = 700 * 1024;   // 700 KB
export const FILE_SIZE_LIMIT_DRIVE  = 50 * 1024 * 1024; // 50 MB