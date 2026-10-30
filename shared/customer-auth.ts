import { z } from "zod";

export const customerAuthMessages = {
  email: "أدخل بريداً إلكترونياً صالحاً / Enter a valid email address",
  password:
    "كلمة المرور من 12 إلى 128 حرفاً / Password must contain 12 to 128 characters",
  name: "الاسم من حرفين إلى 100 حرف / Name must contain 2 to 100 characters",
  phone:
    "أدخل رقم جوال أردنياً أو رقماً دولياً يبدأ بـ + / Enter a Jordan mobile number or an international number beginning with +",
  confirmation: "كلمتا المرور غير متطابقتين / Passwords do not match",
  credentials:
    "البريد أو كلمة المرور غير صحيحة، أو الدخول غير متاح / Invalid credentials or account access unavailable",
  duplicate:
    "تعذر إنشاء الحساب؛ جرّب تسجيل الدخول أو استعادة كلمة المرور / Account cannot be registered; try signing in or password recovery",
  token:
    "رمز الاستعادة غير صالح أو منتهي الصلاحية / Recovery code is invalid or expired",
  rate: "محاولات كثيرة؛ حاول لاحقاً / Too many attempts; try again later",
} as const;

/** Preserve national/international intent. No country is guessed or prepended. */
export function normalizeCustomerPhone(value: string) {
  return value
    .trim()
    .replace(/[٠-٩]/g, digit => String(digit.charCodeAt(0) - 0x660))
    .replace(/[۰-۹]/g, digit => String(digit.charCodeAt(0) - 0x6f0))
    .replace(/[ ()\-.]/g, "");
}
export const customerPhoneSchema = z
  .string()
  .max(40, customerAuthMessages.phone)
  .transform(normalizeCustomerPhone)
  .refine(
    value =>
      value === "" ||
      /^07[789]\d{7}$/.test(value) ||
      /^\+[1-9]\d{7,14}$/.test(value),
    customerAuthMessages.phone
  );
export const customerEmailSchema = z
  .string()
  .trim()
  .email(customerAuthMessages.email)
  .max(320, customerAuthMessages.email)
  .transform(value => value.toLowerCase());
export const customerPasswordSchema = z
  .string()
  .min(12, customerAuthMessages.password)
  .max(128, customerAuthMessages.password)
  .refine(value => value.trim().length >= 12, customerAuthMessages.password);
export const customerNameSchema = z
  .string()
  .trim()
  .min(2, customerAuthMessages.name)
  .max(100, customerAuthMessages.name);
export const customerLanguageSchema = z.enum(["ar", "en"]).optional();
export const customerRegisterSchema = z
  .object({
    email: customerEmailSchema,
    password: customerPasswordSchema,
    name: customerNameSchema,
    phone: customerPhoneSchema.optional(),
    language: customerLanguageSchema,
    inviteCode: z.string().length(64).optional(),
  })
  .strict();
export const passwordResetRequestSchema = z
  .object({ email: customerEmailSchema, language: customerLanguageSchema })
  .strict();
export const passwordResetSchema = z
  .object({
    token: z.string().regex(/^[a-f0-9]{64}$/, customerAuthMessages.token),
    password: customerPasswordSchema,
    confirmPassword: z.string().max(128),
    language: customerLanguageSchema,
  })
  .strict()
  .refine(value => value.password === value.confirmPassword, {
    message: customerAuthMessages.confirmation,
    path: ["confirmPassword"],
  });
