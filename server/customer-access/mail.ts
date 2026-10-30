import { createCipheriv, randomBytes, randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export interface CustomerResetMessage {
  to: string;
  resetUrl: string;
  language: "ar" | "en";
  expiresAt: string;
}
export interface CustomerResetMailProvider {
  delivery: "development" | "email";
  send(message: CustomerResetMessage): Promise<void>;
}
const isDevelopment = () =>
  ["test", "development"].includes(process.env.NODE_ENV ?? "");

/** A fixed configured origin; no input, Host or forwarded header participates. */
export function customerResetOrigin(): string | null {
  try {
    const origin = new URL(process.env.RESET_WEB_ORIGIN ?? "");
    const loopbackTest =
      process.env.NODE_ENV === "test" &&
      ["localhost", "127.0.0.1", "[::1]"].includes(origin.hostname);
    if (
      (origin.protocol !== "https:" &&
        !(loopbackTest && origin.protocol === "http:")) ||
      origin.username ||
      origin.password ||
      origin.pathname !== "/" ||
      origin.search ||
      origin.hash
    )
      return null;
    return origin.origin;
  } catch {
    return null;
  }
}
function developmentDirectory() {
  const localRoot = path.resolve(".local");
  const directory = path.resolve(
    process.env.CUSTOMER_RESET_DEV_DIR ??
      path.join(localRoot, "customer-access")
  );
  const relative = path.relative(localRoot, directory);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative))
    throw new Error("Invalid development mail directory");
  return directory;
}
async function developmentSend(message: CustomerResetMessage) {
  if (!isDevelopment() || !/^[^@\s]+@example\.test$/i.test(message.to))
    throw new Error("Development delivery restricted");
  const directory = developmentDirectory();
  await mkdir(path.join(directory, "outbox"), { recursive: true, mode: 0o700 });
  const keyFile = path.join(directory, "mail.key");
  try {
    await writeFile(keyFile, randomBytes(32), { flag: "wx", mode: 0o600 });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
  }
  const key = await readFile(keyFile);
  if (key.length !== 32) throw new Error("Invalid development mail key");
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(JSON.stringify(message), "utf8"),
    cipher.final(),
  ]);
  await writeFile(
    path.join(directory, "outbox", `${randomUUID()}.json`),
    JSON.stringify({
      version: 1,
      iv: iv.toString("base64"),
      tag: cipher.getAuthTag().toString("base64"),
      ciphertext: ciphertext.toString("base64"),
    }),
    { flag: "wx", mode: 0o600 }
  );
}
export function customerResetMailProvider(): CustomerResetMailProvider | null {
  if (!customerResetOrigin()) return null;
  if (
    process.env.CUSTOMER_RESET_MAIL_MODE === "development" &&
    isDevelopment()
  ) {
    // Fail configuration validation uniformly, before any account lookup.
    developmentDirectory();
    return { delivery: "development", send: developmentSend };
  }
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.CUSTOMER_RESET_EMAIL_FROM;
  if (
    !apiKey ||
    !from ||
    /[\r\n]/.test(from) ||
    !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(from)
  )
    return null;
  return {
    delivery: "email",
    async send(message) {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        signal: AbortSignal.timeout(10_000),
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from,
          to: [message.to],
          subject:
            message.language === "ar"
              ? "استعادة كلمة المرور - GO Pharmacy"
              : "GO Pharmacy password recovery",
          text:
            message.language === "ar"
              ? `لاستعادة كلمة المرور خلال 15 دقيقة افتح الرابط: ${message.resetUrl}\nإذا لم تطلب ذلك، تجاهل الرسالة.`
              : `To reset your password within 15 minutes, open: ${message.resetUrl}\nIgnore this message if you did not request it.`,
        }),
      });
      // Never expose provider response bodies (may contain addresses or payloads).
      if (!response.ok) throw new Error("Recovery transport unavailable");
      await response.body?.cancel();
    },
  };
}
