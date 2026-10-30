import type { QueryClient } from "@tanstack/react-query";
import { customerAuthMessages } from "@shared/customer-auth";

export function authErrorMessage(
  error: unknown,
  operation: "login" | "register" | "request" | "reset"
): string {
  const code = (error as { data?: { code?: string } } | null)?.data?.code;
  const transport = error as {
    message?: unknown;
    cause?: { message?: unknown };
  } | null;
  const messages = [transport?.message, transport?.cause?.message].filter(
    (value): value is string => typeof value === "string"
  );
  if (messages.includes("LOCAL_REMINDER_CLEANUP_FAILED"))
    return "تعذر تنظيف تنبيهات الحساب السابق على الجهاز. أعد فتح التطبيق وحاول مجدداً قبل تبديل الحساب / Could not clear previous account reminders; reopen the app before switching accounts";
  if (
    !code &&
    messages.some(value =>
      /ssl|tls|certificate|cert_authority|cert_date|cert_common_name/i.test(
        value
      )
    )
  )
    return "تعذر التحقق من اتصال HTTPS الآمن. تحقق من عنوان الخادم وصلاحية شهادته / Secure HTTPS verification failed. Check the server address and certificate";
  if (code === "SERVICE_UNAVAILABLE")
    return "الخادم غير متاح مؤقتاً؛ حاول لاحقاً / Server temporarily unavailable; try again later";
  if (code === "TOO_MANY_REQUESTS") return customerAuthMessages.rate;
  if (code === "UNAUTHORIZED" || code === "FORBIDDEN")
    return operation === "reset"
      ? customerAuthMessages.token
      : customerAuthMessages.credentials;
  if (code === "CONFLICT" && operation === "register")
    return customerAuthMessages.duplicate;
  if (code === "BAD_REQUEST")
    return operation === "reset"
      ? customerAuthMessages.token
      : "راجع البيانات المدخلة وحاول مجدداً / Check your details and try again";
  if (!code)
    return "تعذر الاتصال بالخادم. تحقق من الاتصال وعنوان الخدمة ثم أعد المحاولة / Cannot reach the server. Check your connection and service address, then try again";
  return "تعذر إكمال الطلب حالياً؛ حاول لاحقاً / The request could not be completed; try again later";
}

export function recoveryDeliveryMessage(
  delivery: "unavailable" | "development" | "email"
): string {
  if (delivery === "unavailable")
    return "خدمة البريد غير مهيأة؛ لم يُرسل بريد استعادة. تواصل مع مسؤول الخدمة / Email recovery is not configured; no recovery email was sent. Contact the service administrator";
  if (delivery === "development")
    return "وضع اختبار محلي: لم يُرسل بريد حقيقي. استخدم رمز الاختبار الذي يوفره مسؤول بيئة التطوير / Local test mode: no real email was sent. Use the test code supplied by your development administrator";
  return "إذا كان البريد مرتبطاً بحساب مؤهل فستصلك تعليمات الاستعادة. تحقق من البريد غير المرغوب أيضاً / If this email belongs to an eligible account, recovery instructions will arrive. Check your spam folder too";
}

/** Read once into component memory, then remove the fragment from browser history. */
export function consumeRecoveryFragment(
  location: Pick<Location, "hash" | "pathname" | "search">,
  history: Pick<History, "state" | "replaceState">
): string {
  const token = new URLSearchParams(location.hash.slice(1)).get("token") ?? "";
  if (location.hash)
    history.replaceState(
      history.state,
      "",
      location.pathname + location.search
    );
  return /^[a-f0-9]{64}$/.test(token) ? token : "";
}

export async function clearAccountCache(client: QueryClient) {
  await client.cancelQueries();
  client.clear();
}
