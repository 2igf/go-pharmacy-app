import { z } from "zod";

// Escaped punctuation is required by HTML pattern's Unicode-v character classes.
export const checkoutPhonePattern = "[+0-9٠-٩۰-۹ \\(\\)\\-]{6,30}";
export function normalizeCheckoutPhone(value: string) {
  // Preserve existing ASCII formatting exactly: its bytes participate in replay hashes.
  return value.replace(/[٠-٩۰-۹]/g, digit =>
    String(digit.charCodeAt(0) - (digit <= "٩" ? 0x660 : 0x6f0))
  );
}
export const checkoutSchema = z
  .object({
    addressId: z.number().int().positive(),
    idempotencyKey: z.string().uuid(),
    contactName: z.string().trim().min(2).max(100),
    contactPhone: z
      .string()
      .transform(normalizeCheckoutPhone)
      .pipe(z.string().regex(/^[+0-9 ()-]{6,30}$/)),
    expectedTotal: z.string().regex(/^\d{1,8}\.\d{2}$/),
    paymentMethod: z.literal("cash"),
    simulationAcknowledged: z.literal(true),
    expectedCartHash: z.string().regex(/^[a-f0-9]{64}$/),
  })
  .strict();
export type CheckoutRequest = z.infer<typeof checkoutSchema>;
const messages = {
  addressId: "العنوان الخيالي: اختر عنوانًا محفوظًا صالحًا.",
  contactName:
    "اسم المستلم الخيالي: أدخل اسمًا من حرفين إلى 100 حرف بعد إزالة الفراغات الطرفية.",
  contactPhone:
    "رقم الاختبار: أدخل من 6 إلى 30 خانة بالأرقام العربية أو اللاتينية، مع + أو مسافة أو أقواس أو شرطة فقط.",
  expectedTotal: "إجمالي السلة: حدّث السلة وراجع المبلغ قبل الإرسال.",
  expectedCartHash: "محتويات السلة: حدّث السلة وراجع المنتجات قبل الإرسال.",
  idempotencyKey: "معرّف الإرسال: راجع الطلب المحفوظ قبل إنشاء إرسال جديد.",
  paymentMethod:
    "طريقة المحاكاة: النقد التجريبي هو الخيار المتاح؛ لا يوجد دفع فعلي.",
  simulationAcknowledged:
    "إقرار المحاكاة: يلزم تأكيد أن الطلب تجريبي دون دفع أو توصيل.",
  request: "طلب المحاكاة: الحقول المرسلة غير صالحة؛ راجع النموذج.",
} as const;
export function checkoutValidationIssues(
  issues: readonly { path: readonly PropertyKey[]; code: string }[]
) {
  return issues.map(issue => {
    const candidate = String(issue.path[0] ?? "request");
    const field = Object.prototype.hasOwnProperty.call(messages, candidate)
      ? (candidate as keyof typeof messages)
      : "request";
    return { field, code: issue.code, message: messages[field] };
  });
}
export function parsePendingCheckout(
  serialized: string | null
): CheckoutRequest | null {
  if (!serialized || serialized.length > 5000) return null;
  try {
    const result = checkoutSchema.safeParse(JSON.parse(serialized));
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}
