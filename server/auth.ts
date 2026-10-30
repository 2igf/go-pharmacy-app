import {
  randomBytes,
  randomUUID,
  createHash,
  createHmac,
  scrypt as scryptCallback,
  timingSafeEqual,
} from "node:crypto";
import { promisify } from "node:util";
import { parse } from "cookie";
import { and, eq, gt } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import type { Request, Response } from "express";
import { z } from "zod";
import { credentials, sessions, users } from "../drizzle/schema";
import type { User } from "../drizzle/schema";
import { customerAccounts } from "../drizzle/customer-access";
import {
  customerAuthMessages,
  customerEmailSchema,
  customerLanguageSchema,
  customerNameSchema,
  customerPhoneSchema,
  customerRegisterSchema,
  passwordResetRequestSchema,
  passwordResetSchema,
} from "../shared/customer-auth";
import { enforceCustomerAuthLimit } from "./customer-access/rate-limit";
import {
  consumeCustomerPasswordReset,
  requestCustomerPasswordReset,
} from "./customer-access/recovery";
import { COOKIE_NAME } from "../shared/const";
import { getDb } from "./db";
import { router, protectedProcedure, publicProcedure } from "./_core/trpc";
import { getSessionCookieOptions } from "./_core/cookies";
const scrypt = promisify(scryptCallback);
const SESSION_MS = 8 * 60 * 60 * 1000;
export const normalizeEmail = (email: string) => email.trim().toLowerCase();
export function validateAuthConfig() {
  const secret = process.env.BETA_INVITE_SECRET;
  if (!secret || secret.length < 32 || /^(REPLACE|CHANGE_ME)/i.test(secret))
    throw new TRPCError({
      code: "SERVICE_UNAVAILABLE",
      message: "Invitations are not configured",
    });
  return secret;
}
export function invitationCodeFor(email: string) {
  const secret = validateAuthConfig();
  return createHmac("sha256", secret)
    .update(normalizeEmail(email))
    .digest("hex");
}
export function validInvitation(email: string, code: string) {
  return (
    /^[a-f0-9]{64}$/.test(code) &&
    timingSafeEqual(
      Buffer.from(code, "hex"),
      Buffer.from(invitationCodeFor(email), "hex")
    )
  );
}
export function betaAllowed(email: string | null) {
  if (process.env.PRIVATE_BETA === "false") return true;
  return (
    !!email &&
    (process.env.BETA_ALLOWED_EMAILS ?? "")
      .split(",")
      .map(normalizeEmail)
      .includes(normalizeEmail(email))
  );
}
async function accountAllowed(
  user: User,
  executor?: Pick<AuthDatabase, "select">
) {
  if (betaAllowed(user.email)) return true;
  if (user.role !== "user") return false;
  const db = executor ?? (await getDb());
  const [marker] = await db
    .select()
    .from(customerAccounts)
    .where(eq(customerAccounts.userId, user.id));
  return marker?.accessSource === "public";
}
export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const key = (await scrypt(password, salt, 64)) as Buffer;
  return `scrypt:${salt}:${key.toString("hex")}`;
}
export async function verifyPassword(password: string, encoded: string) {
  const [scheme, salt, hex] = encoded.split(":");
  if (
    scheme !== "scrypt" ||
    !/^[a-f0-9]{32}$/.test(salt ?? "") ||
    !/^[a-f0-9]{128}$/.test(hex ?? "")
  )
    return false;
  const key = (await scrypt(password, salt, 64)) as Buffer;
  return timingSafeEqual(key, Buffer.from(hex, "hex"));
}
const digest = (token: string) =>
  createHash("sha256").update(token).digest("hex");
export async function authenticateRequest(req: Request) {
  const token = parse(req.headers.cookie ?? "")[COOKIE_NAME];
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return null;
  const db = await getDb();
  const [row] = await db
    .select({ user: users })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(
      and(
        eq(sessions.tokenHash, digest(token)),
        gt(sessions.expiresAt, new Date())
      )
    );
  return row && (await accountAllowed(row.user)) ? row.user : null;
}
type AuthDatabase = Awaited<ReturnType<typeof getDb>>;
type AuthTransaction = Parameters<
  Parameters<AuthDatabase["transaction"]>[0]
>[0];
async function storeSession(
  db: AuthDatabase | AuthTransaction,
  userId: number
) {
  const token = randomBytes(32).toString("hex");
  await db.insert(sessions).values({
    userId,
    tokenHash: digest(token),
    expiresAt: new Date(Date.now() + SESSION_MS),
  });
  return token;
}
function setSessionCookie(token: string, req: Request, res: Response) {
  res.cookie(COOKIE_NAME, token, {
    ...getSessionCookieOptions(req),
    maxAge: SESSION_MS,
  });
}
const email = customerEmailSchema;
// Preserve sign-in compatibility for previously accepted passwords.
const password = z
  .string()
  .min(1, customerAuthMessages.credentials)
  .max(128, customerAuthMessages.credentials);
const invalidCredentials = () =>
  new TRPCError({
    code: "UNAUTHORIZED",
    message: customerAuthMessages.credentials,
  });
export const authRouter = router({
  me: publicProcedure.query(({ ctx }) => ctx.user),
  register: publicProcedure
    .input(customerRegisterSchema)
    .mutation(async ({ input, ctx }) => {
      enforceCustomerAuthLimit("register", ctx.req, input.email);
      // Old installed clients may still submit an invite; validate when supplied.
      if (
        input.inviteCode !== undefined &&
        (!betaAllowed(input.email) ||
          !validInvitation(input.email, input.inviteCode))
      )
        throw invalidCredentials();
      const db = await getDb();
      const passwordHash = await hashPassword(input.password);
      let sessionToken: string;
      try {
        sessionToken = await db.transaction(async tx => {
          const [existing] = await tx
            .select()
            .from(credentials)
            .where(eq(credentials.email, input.email));
          const [legacy] = await tx
            .select({ id: users.id })
            .from(users)
            .where(eq(users.email, input.email));
          if (existing || legacy)
            throw new TRPCError({
              code: "CONFLICT",
              message: customerAuthMessages.duplicate,
            });
          const [user] = await tx.insert(users).values({
            openId: `local:${randomUUID()}`,
            email: input.email,
            name: input.name,
            phone: input.phone ?? null,
            role: "user",
            loginMethod: "local",
          });
          await tx.insert(credentials).values({
            userId: user.insertId,
            email: input.email,
            passwordHash,
          });
          await tx.insert(customerAccounts).values({
            userId: user.insertId,
            accessSource: input.inviteCode === undefined ? "public" : "legacy",
            verificationState: "unverified",
          });
          return storeSession(tx, user.insertId);
        });
      } catch (error) {
        const databaseCode =
          (error as { code?: string; cause?: { code?: string } }).cause?.code ??
          (error as { code?: string }).code;
        if (databaseCode === "ER_DUP_ENTRY")
          throw new TRPCError({
            code: "CONFLICT",
            message: customerAuthMessages.duplicate,
          });
        throw error;
      }
      setSessionCookie(sessionToken, ctx.req, ctx.res);
      return { success: true };
    }),
  login: publicProcedure
    .input(
      z.object({ email, password, language: customerLanguageSchema }).strict()
    )
    .mutation(async ({ input, ctx }) => {
      enforceCustomerAuthLimit("login", ctx.req, input.email);
      const db = await getDb();
      const sessionToken = await db.transaction(async tx => {
        // Share the credential lock with reset so a pre-reset login cannot mint
        // a session after all old sessions have been revoked.
        const [credential] = await tx
          .select()
          .from(credentials)
          .where(eq(credentials.email, input.email))
          .for("update");
        const dummy =
          "scrypt:00000000000000000000000000000000:" + "0".repeat(128);
        const valid = await verifyPassword(
          input.password,
          credential?.passwordHash ?? dummy
        );
        const [user] = credential
          ? await tx.select().from(users).where(eq(users.id, credential.userId))
          : [];
        if (!credential || !valid || !user || !(await accountAllowed(user, tx)))
          throw invalidCredentials();
        return storeSession(tx, credential.userId);
      });
      setSessionCookie(sessionToken, ctx.req, ctx.res);
      return { success: true };
    }),
  accountStatus: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    const [marker] = await db
      .select()
      .from(customerAccounts)
      .where(eq(customerAccounts.userId, ctx.user.id));
    return {
      accessSource: marker?.accessSource ?? "legacy",
      verificationState: "unverified" as const,
      emailVerified: false as const,
    };
  }),
  requestPasswordReset: publicProcedure
    .input(passwordResetRequestSchema)
    .mutation(({ input, ctx }) => {
      enforceCustomerAuthLimit("request-reset", ctx.req, input.email);
      return requestCustomerPasswordReset(
        input.email,
        input.language ?? "ar",
        accountAllowed
      );
    }),
  resetPassword: publicProcedure
    .input(passwordResetSchema)
    .mutation(async ({ input, ctx }) => {
      enforceCustomerAuthLimit("reset", ctx.req, input.token);
      const result = await consumeCustomerPasswordReset(
        input.token,
        await hashPassword(input.password),
        accountAllowed
      );
      ctx.res.clearCookie(COOKIE_NAME, {
        ...getSessionCookieOptions(ctx.req),
      });
      return result;
    }),
  logout: publicProcedure.mutation(async ({ ctx }) => {
    const token = parse(ctx.req.headers.cookie ?? "")[COOKIE_NAME];
    if (token) {
      const db = await getDb();
      await db.delete(sessions).where(eq(sessions.tokenHash, digest(token)));
    }
    ctx.res.clearCookie(COOKIE_NAME, {
      ...getSessionCookieOptions(ctx.req),
      maxAge: -1,
    });
    return { success: true } as const;
  }),
  updateProfile: protectedProcedure
    .input(
      z
        .object({
          name: customerNameSchema,
          phone: customerPhoneSchema,
        })
        .strict()
    )
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      await db.update(users).set(input).where(eq(users.id, ctx.user.id));
      return { success: true };
    }),
});
