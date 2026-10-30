import { createHash, randomBytes } from "node:crypto";
import { and, eq, gt, isNull } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { customerPasswordResets } from "../../drizzle/customer-access";
import { credentials, sessions, users, type User } from "../../drizzle/schema";
import { customerAuthMessages } from "../../shared/customer-auth";
import { getDb } from "../db";
import { customerResetMailProvider, customerResetOrigin } from "./mail";

const TOKEN_LIFETIME_MS = 15 * 60_000;
export const hashResetToken = (token: string) =>
  createHash("sha256").update(token).digest("hex");
type Admission = (
  user: User,
  executor?: Pick<Awaited<ReturnType<typeof getDb>>, "select">
) => Promise<boolean>;
const deliveryQueue: Array<() => Promise<void>> = [];
const waiters: Array<() => void> = [];
let active = 0;
let scheduled = false;
function drain() {
  scheduled = false;
  while (active < 2 && deliveryQueue.length) {
    const task = deliveryQueue.shift()!;
    active++;
    void task()
      .catch(() => {
        // Fixed event only: no recipient, token, password or transport response.
        console.warn(
          JSON.stringify({ event: "customer_recovery_delivery_unavailable" })
        );
      })
      .finally(() => {
        active--;
        drain();
        if (!active && !deliveryQueue.length)
          waiters.splice(0).forEach(resolve => resolve());
      });
  }
}
export function flushCustomerResetDeliveries(): Promise<void> {
  if (!["test", "development"].includes(process.env.NODE_ENV ?? ""))
    throw new Error("Delivery inspection is development-only");
  return !active && !deliveryQueue.length
    ? Promise.resolve()
    : new Promise(resolve => waiters.push(resolve));
}
/** Public response reports request acceptance/channel, never existence or a sent guarantee.
 * Queue is bounded and deliberately non-durable; process restart may lose requests.
 */
export function requestCustomerPasswordReset(
  email: string,
  language: "ar" | "en",
  admitted: Admission
) {
  const provider = customerResetMailProvider();
  if (!provider) return { accepted: true, delivery: "unavailable" } as const;
  // Queue admission is account-independent. This executes before any account lookup.
  if (deliveryQueue.length + active >= 64)
    throw new TRPCError({
      code: "SERVICE_UNAVAILABLE",
      message:
        "الاستعادة غير متاحة مؤقتاً / Recovery is temporarily unavailable",
    });
  deliveryQueue.push(async () => {
    const db = await getDb();
    const [account] = await db
      .select({ credential: credentials, user: users })
      .from(credentials)
      .innerJoin(users, eq(credentials.userId, users.id))
      .where(eq(credentials.email, email));
    if (!account || !(await admitted(account.user, db))) return;
    const token = randomBytes(32).toString("hex");
    const tokenHash = hashResetToken(token);
    const expiresAt = new Date(Date.now() + TOKEN_LIFETIME_MS);
    await db.transaction(async tx => {
      // Serialize token issuance and resets for this credential/account.
      await tx
        .select({ userId: credentials.userId })
        .from(credentials)
        .where(eq(credentials.userId, account.user.id))
        .for("update");
      await tx
        .insert(customerPasswordResets)
        .values({ userId: account.user.id, tokenHash, expiresAt });
    });
    const resetUrl = new URL("/login?mode=reset", customerResetOrigin()!);
    resetUrl.hash = `token=${token}`;
    try {
      await provider.send({
        to: email,
        resetUrl: resetUrl.toString(),
        language,
        expiresAt: expiresAt.toISOString(),
      });
    } catch {
      // Failed transport must not leave an undistributed live reset credential.
      await db
        .update(customerPasswordResets)
        .set({ usedAt: new Date() })
        .where(eq(customerPasswordResets.tokenHash, tokenHash));
      throw new Error("Recovery transport unavailable");
    }
  });
  if (!scheduled) {
    scheduled = true;
    setImmediate(drain);
  }
  return { accepted: true, delivery: provider.delivery } as const;
}
export async function consumeCustomerPasswordReset(
  token: string,
  passwordHash: string,
  admitted: Admission
) {
  const db = await getDb();
  const tokenHash = hashResetToken(token);
  const invalid = () =>
    new TRPCError({ code: "BAD_REQUEST", message: customerAuthMessages.token });
  const [candidate] = await db
    .select({ userId: customerPasswordResets.userId })
    .from(customerPasswordResets)
    .where(eq(customerPasswordResets.tokenHash, tokenHash));
  if (!candidate) throw invalid();
  await db.transaction(async tx => {
    const [credential] = await tx
      .select()
      .from(credentials)
      .where(eq(credentials.userId, candidate.userId))
      .for("update");
    const [user] = await tx
      .select()
      .from(users)
      .where(eq(users.id, candidate.userId));
    if (!credential || !user || !(await admitted(user, tx))) throw invalid();
    const now = new Date();
    const [valid] = await tx
      .select()
      .from(customerPasswordResets)
      .where(
        and(
          eq(customerPasswordResets.tokenHash, tokenHash),
          isNull(customerPasswordResets.usedAt),
          gt(customerPasswordResets.expiresAt, now)
        )
      )
      .for("update");
    if (!valid) throw invalid();
    await tx
      .update(credentials)
      .set({ passwordHash })
      .where(eq(credentials.userId, candidate.userId));
    await tx.delete(sessions).where(eq(sessions.userId, candidate.userId));
    await tx
      .update(customerPasswordResets)
      .set({ usedAt: now })
      .where(
        and(
          eq(customerPasswordResets.userId, candidate.userId),
          isNull(customerPasswordResets.usedAt)
        )
      );
  });
  return { success: true } as const;
}
