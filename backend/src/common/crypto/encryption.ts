import crypto from "node:crypto";

const ALGORITHM = "aes-256-gcm";

function normalizeKey(secret: string): Buffer {
  if (!secret) {
    throw new Error("ENCRYPTION_KEY is required");
  }
  return crypto.createHash("sha256").update(secret).digest();
}

export function encryptSecret(value: string, secret = process.env.ENCRYPTION_KEY ?? ""): string {
  const iv = crypto.randomBytes(12);
  const key = normalizeKey(secret);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv.toString("base64"), tag.toString("base64"), encrypted.toString("base64")].join(".");
}

export function decryptSecret(payload: string, secret = process.env.ENCRYPTION_KEY ?? ""): string {
  const [ivText, tagText, encryptedText] = payload.split(".");
  if (!ivText || !tagText || !encryptedText) {
    throw new Error("Invalid encrypted payload");
  }
  const decipher = crypto.createDecipheriv(ALGORITHM, normalizeKey(secret), Buffer.from(ivText, "base64"));
  decipher.setAuthTag(Buffer.from(tagText, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(encryptedText, "base64")), decipher.final()]).toString("utf8");
}

export function maskSecret(value?: string | null): string | null {
  if (!value) return null;
  if (value.length <= 8) return "********";
  return `${value.slice(0, 4)}...${value.slice(-4)}`;
}

export function maskRecord(input: Record<string, unknown>): Record<string, unknown> {
  const sensitive = new Set(["authorization", "apiKey", "api_key", "password", "token", "serviceAccountJson"]);
  return Object.fromEntries(
    Object.entries(input).map(([key, value]) => [key, sensitive.has(key.toLowerCase()) ? "***masked***" : value])
  );
}
