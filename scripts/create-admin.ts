import "dotenv/config";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { credentials, users } from "../drizzle/schema";
import { getDb, closeDb } from "../server/db";
import { hashPassword, normalizeEmail, betaAllowed } from "../server/auth";
const email = normalizeEmail(z.string().email().parse(process.env.ADMIN_EMAIL));
const password = z.string().min(16).max(128).parse(process.env.ADMIN_PASSWORD);
if (process.env.CONFIRM_CREATE_ADMIN !== "yes" || !betaAllowed(email))
  throw new Error(
    "Explicit admin creation confirmation and Beta allowlist membership required"
  );
try {
  const db = await getDb();
  const passwordHash = await hashPassword(password);
  await db.transaction(async tx => {
    const [existing] = await tx
      .select()
      .from(credentials)
      .where(eq(credentials.email, email));
    if (existing)
      throw new Error(
        "Account already exists; this command never silently promotes or resets an existing account"
      );
    const [user] = await tx
      .insert(users)
      .values({
        openId: `local:${randomUUID()}`,
        email,
        name: "Beta Administrator",
        role: "admin",
        loginMethod: "local",
      });
    await tx
      .insert(credentials)
      .values({ userId: user.insertId, email, passwordHash });
  });
  console.log(
    "Administrator created. Password was not logged. Remove ADMIN_PASSWORD from the environment."
  );
} finally {
  await closeDb();
}
