export type PromotionalBanner = {
  id: string;
  src: string;
  alt: string;
  href?: string;
};
/** Only distinct supplied artwork belongs here. Multi-slide fixtures stay in tests. */
export const promotionalBanners: readonly PromotionalBanner[] = [
  {
    id: "canva-dozova",
    src: "/canva/banner-dozova.png",
    alt: "بنر Dozova من التصميم الأصلي — معاينة بصرية فقط",
    href: "/products?view=all",
  },
];

export function nextBannerIndex(
  index: number,
  direction: number,
  count: number
) {
  return count > 1 ? (((index + direction) % count) + count) % count : 0;
}

export function swipeBannerDirection(
  deltaX: number,
  deltaY: number,
  rtl: boolean
): number {
  if (Math.abs(deltaX) < 40 || Math.abs(deltaX) <= Math.abs(deltaY)) return 0;
  return (deltaX > 0 ? 1 : -1) * (rtl ? 1 : -1);
}

export function safeBannerHref(value: string | undefined): string | undefined {
  if (
    !value ||
    !value.startsWith("/") ||
    value.startsWith("//") ||
    /[\\\u0000-\u0020\u007f]/.test(value)
  )
    return undefined;
  const url = new URL(value, "https://go-pharmacy.invalid");
  if (url.hash) return undefined;
  if (url.pathname === "/doctors" || /^\/product\/[1-9]\d*$/.test(url.pathname))
    return url.search ? undefined : value;
  if (url.pathname !== "/products") return undefined;
  for (const [key, entry] of url.searchParams) {
    if (
      !["view", "category", "search"].includes(key) ||
      /[\u0000-\u001f\u007f]/.test(entry)
    )
      return undefined;
    if (key === "view" && entry !== "all") return undefined;
  }
  return value;
}

export function scheduleBannerAdvance(
  advance: () => void,
  options: { count: number; paused: boolean; reducedMotion: boolean }
): () => void {
  if (options.count < 2 || options.paused || options.reducedMotion)
    return () => {};
  const timer = setTimeout(advance, 5000);
  return () => clearTimeout(timer);
}
