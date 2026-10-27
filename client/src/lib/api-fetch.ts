import { Capacitor, CapacitorHttp } from "@capacitor/core";
import {
  ANDROID_ORIGIN,
  ANDROID_CLIENT_HEADER,
  nativeRequestUrl,
  normalizeApiOrigin,
} from "@shared/native-api";

const CONFIG_KEY = "go-pharmacy:android-api-origin";
export const isAndroid = () => Capacitor.getPlatform() === "android";
export function getNativeApiOrigin(): string | null {
  if (!isAndroid()) return null;
  try {
    const value =
      localStorage.getItem(CONFIG_KEY) ||
      import.meta.env.VITE_ANDROID_API_ORIGIN;
    return value ? normalizeApiOrigin(value) : null;
  } catch {
    return null;
  }
}
export function saveNativeApiOrigin(value: string) {
  localStorage.setItem(CONFIG_KEY, normalizeApiOrigin(value));
}
export function clearNativeApiOrigin() {
  localStorage.removeItem(CONFIG_KEY);
}
export async function apiFetch(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  if (!isAndroid())
    return globalThis.fetch(input, { ...init, credentials: "include" });
  const origin = getNativeApiOrigin();
  if (!origin) throw new Error("اضبط عنوان خادم HTTPS للاتصال بالخدمة.");
  const url = nativeRequestUrl(
    origin,
    input instanceof Request ? input.url : String(input)
  );
  if (init?.signal?.aborted) throw new DOMException("Aborted", "AbortError");
  const headers = new Headers(init?.headers);
  // The native transport declares its actual bundled UI origin. It does not
  // masquerade as the hosted website or handle session tokens in JavaScript.
  headers.set("Origin", ANDROID_ORIGIN);
  headers.set(ANDROID_CLIENT_HEADER, "android");
  const response = await CapacitorHttp.request({
    url,
    method: init?.method ?? "GET",
    headers: Object.fromEntries(headers.entries()),
    ...(typeof init?.body === "string" ? { data: init.body } : {}),
    responseType: "text",
    connectTimeout: 15000,
    readTimeout: 30000,
    disableRedirects: true,
  });
  if (init?.signal?.aborted) throw new DOMException("Aborted", "AbortError");
  if (response.status >= 300 && response.status < 400)
    throw new Error(
      "الخادم أعاد توجيه الاتصال. استخدم عنوان HTTPS النهائي مباشرة."
    );
  const responseHeaders = new Headers(response.headers);
  // CookieManager processes Set-Cookie natively. Do not hand that header to
  // React/tRPC or persist a session token in JavaScript storage.
  responseHeaders.delete("set-cookie");
  responseHeaders.delete("set-cookie2");
  return new Response(
    typeof response.data === "string"
      ? response.data
      : JSON.stringify(response.data),
    {
      status: response.status,
      headers: responseHeaders,
    }
  );
}
