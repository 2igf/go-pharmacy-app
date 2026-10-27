// Public connection configuration only. Never put credentials in this URL.
export const ANDROID_ORIGIN = "https://localhost";
export const ANDROID_CLIENT_HEADER = "X-Go-Pharmacy-Client";
export function normalizeApiOrigin(value: string): string {
  const url = new URL(value.trim());
  const host = url.hostname.toLowerCase();
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.pathname !== "/" ||
    url.search ||
    url.hash ||
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host === "[::1]" ||
    host === "0.0.0.0" ||
    host.startsWith("127.")
  )
    throw new Error(
      "Use a reachable HTTPS server origin without credentials or a path"
    );
  return url.origin;
}
export function nativeRequestUrl(origin: string, value: string): string {
  const expected = normalizeApiOrigin(origin);
  const url = new URL(value);
  if (
    url.origin !== expected ||
    url.username ||
    url.password ||
    !url.pathname.startsWith("/api/trpc/")
  )
    throw new Error(
      "Native requests are restricted to the configured tRPC API"
    );
  return url.href;
}
