import { NOT_ADMIN_ERR_MSG, UNAUTHED_ERR_MSG } from "@shared/const";
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import { ZodError } from "zod";
import type { TrpcContext } from "./context";
import { canUseService } from "../access-policy";
import { checkoutValidationIssues } from "../../shared/checkout";
import { customerAuthMessages } from "../../shared/customer-auth";

const t = initTRPC.context<TrpcContext>().create({
  transformer: superjson,
  errorFormatter({ shape, error, path }) {
    const checkoutIssues =
      path === "orders.create" && error.cause instanceof ZodError
        ? checkoutValidationIssues(error.cause.issues)
        : [];
    if (checkoutIssues.length) {
      // Field/code only: never log the request, values, identifiers or credentials.
      console.info(
        JSON.stringify({
          event: "checkout_validation",
          issues: checkoutIssues.map(({ field, code }) => ({ field, code })),
        })
      );
    }
    const { stack: _stack, ...safeData } = shape.data;
    // Only fixed, audited auth messages; never echo Zod's unknown keys/values.
    const authMessages =
      path?.startsWith("auth.") && error.cause instanceof ZodError
        ? error.cause.issues
            .map(issue => issue.message)
            .filter(message =>
              (Object.values(customerAuthMessages) as string[]).includes(
                message
              )
            )
        : [];
    const message = checkoutIssues.length
      ? [...new Set(checkoutIssues.map(issue => issue.message))].join(" ")
      : authMessages.length
        ? [...new Set(authMessages)].join(" ")
        : error.cause instanceof ZodError
          ? "البيانات غير صالحة. تحقق من الحقول المطلوبة وصيغة الاسم والأرقام."
          : shape.message;
    return {
      ...shape,
      message:
        error.code === "INTERNAL_SERVER_ERROR"
          ? "Service error. Please try again."
          : message,
      data: {
        ...safeData,
        validationFields: checkoutIssues.map(issue => issue.field),
      },
    };
  },
});

export const router = t.router;
export const publicProcedure = t.procedure;

const requireUser = t.middleware(async opts => {
  const { ctx, next } = opts;

  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  }

  return next({
    ctx: {
      ...ctx,
      user: ctx.user,
    },
  });
});

export const protectedProcedure = t.procedure
  .use(requireUser)
  .use(({ ctx, next }) => {
    if (!canUseService(ctx.user.role, "personal")) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Account role unavailable",
      });
    }
    return next({ ctx });
  });

export const medicalProcedure = protectedProcedure.use(() => {
  throw new TRPCError({
    code: "FORBIDDEN",
    message:
      "Medical services are disabled in Private Beta. Do not submit patient data.",
  });
});
export const disabledProcedure = t.procedure.use(() => {
  throw new TRPCError({
    code: "FORBIDDEN",
    message: "Service unavailable in Private Beta",
  });
});

export const adminProcedure = t.procedure.use(
  t.middleware(async opts => {
    const { ctx, next } = opts;

    if (!ctx.user || !canUseService(ctx.user.role, "administration")) {
      throw new TRPCError({ code: "FORBIDDEN", message: NOT_ADMIN_ERR_MSG });
    }

    return next({
      ctx: {
        ...ctx,
        user: ctx.user,
      },
    });
  })
);
