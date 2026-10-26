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
  return row && betaAllowed(row.user.email) ? row.user : null;
}
async function issueSession(userId: number, req: Request, res: Response) {
  const db = await getDb();
  const token = randomBytes(32).toString("hex");
  await db
    .insert(sessions)
    .values({
      userId,
      tokenHash: digest(token),
      expiresAt: new Date(Date.now() + SESSION_MS),
    });
  res.cookie(COOKIE_NAME, token, {
    ...getSessionCookieOptions(req),
    maxAge: SESSION_MS,
  });
}
const email = z.string().trim().email().max(320).transform(normalizeEmail);
const password = z.string().min(12).max(128);
const invalidCredentials = () =>
  new TRPCError({
    code: "UNAUTHORIZED",
    message: "Invalid credentials or Beta access unavailable",
  });
export const authRouter = router({
  me: publicProcedure.query(({ ctx }) => ctx.user),
  register: publicProcedure
    .input(
      z
        .object({
          email,
          password,
          name: z.string().trim().min(2).max(100),
          inviteCode: z.string().length(64),
        })
        .strict()
    )
    .mutation(async ({ input, ctx }) => {
      if (
        !betaAllowed(input.email) ||
        !validInvitation(input.email, input.inviteCode)
      )
        throw invalidCredentials();
      const db = await getDb();
      const passwordHash = await hashPassword(input.password);
      const userId = await db.transaction(async tx => {
        const [existing] = await tx
          .select()
          .from(credentials)
          .where(eq(credentials.email, input.email));
        if (existing)
          throw new TRPCError({
            code: "CONFLICT",
            message: "Account cannot be registered; try signing in",
          });
        const [user] = await tx
          .insert(users)
          .values({
            openId: `local:${randomUUID()}`,
            email: input.email,
            name: input.name,
            role: "user",
            loginMethod: "local",
          });
        await tx
          .insert(credentials)
          .values({ userId: user.insertId, email: input.email, passwordHash });
        return user.insertId;
      });
      await issueSession(userId, ctx.req, ctx.res);
      return { success: true };
    }),
  login: publicProcedure
    .input(z.object({ email, password }).strict())
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      const [credential] = await db
        .select()
        .from(credentials)
        .where(eq(credentials.email, input.email));
      const dummy =
        "scrypt:00000000000000000000000000000000:" + "0".repeat(128);
      const valid = await verifyPassword(
        input.password,
        credential?.passwordHash ?? dummy
      );
      if (!credential || !valid || !betaAllowed(input.email))
        throw invalidCredentials();
      await issueSession(credential.userId, ctx.req, ctx.res);
      return { success: true };
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
          name: z.string().trim().min(2).max(100),
          phone: z.string().regex(/^[+0-9 ()-]{0,20}$/),
        })
        .strict()
    )
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      await db.update(users).set(input).where(eq(users.id, ctx.user.id));
      return { success: true };
    }),
});
