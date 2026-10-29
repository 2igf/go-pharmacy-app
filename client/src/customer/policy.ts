export const customerNavigation = [
  { href: "/", label: "الصفحة الرئيسية", icon: "home", unavailable: false },
  { href: "/products", label: "البحث", icon: "search", unavailable: false },
  { href: "/cart", label: "العربة", icon: "cart", unavailable: false },
  { href: "/doctors", label: "اسأل طبيب", icon: "doctor", unavailable: true },
  {
    href: "/reminders",
    label: "منبه الدواء",
    icon: "reminder",
    unavailable: true,
  },
  {
    href: "/profile",
    label: "ملفي الشخصي",
    icon: "profile",
    unavailable: false,
  },
] as const;

export function ownedCustomerRecords<T extends { userId: number }>(
  records: T[] | undefined,
  userId: number | undefined,
  error: unknown
): T[] {
  return !userId || error
    ? []
    : (records ?? []).filter(record => record.userId === userId);
}

export function ownedCustomerQuote<T extends { items: { userId: number }[] }>(
  quote: T | undefined,
  userId: number | undefined,
  error: unknown
): T | undefined {
  return !userId ||
    error ||
    !quote ||
    quote.items.some(item => item.userId !== userId)
    ? undefined
    : quote;
}

type ArtworkProduct = { name: string; imageUrl?: string | null };
export function productArtwork(product: ArtworkProduct): string | null {
  const url = product.imageUrl?.trim();
  if (
    url &&
    ((url.startsWith("/") && !url.startsWith("//") && !url.includes("\\")) ||
      /^https:\/\//i.test(url))
  )
    return url;
  // Only exact identities may reuse their own screenshot artwork. Never label a DEMO item as medicine.
  const name = product.name.trim().toLowerCase();
  if (/demo|اختبار|خيالي/.test(name)) return null;
  const identities: Record<string, string> = {
    "panadol extra": "panadol",
    "بانادول اكسترا": "panadol",
    "بانادول إكسترا": "panadol",
    "بنادول اكسترا": "panadol",
    "votrex 50": "votrex",
    "حبوب فوتركس 50 مجم": "votrex",
    "jp melatonin": "melatonin",
    "حبوب جي بي ميلاتونين": "melatonin",
  };
  return identities[name] ? `/canva/product-${identities[name]}.png` : null;
}

export function filterCatalog<
  T extends {
    name: string;
    manufacturer?: string | null;
    description?: string | null;
    category: string;
  },
>(items: T[], query: string, category: string): T[] {
  const term = query.trim().toLocaleLowerCase();
  return items.filter(
    item =>
      (category === "all" || item.category === category) &&
      [item.name, item.manufacturer, item.description].some(value =>
        value?.toLocaleLowerCase().includes(term)
      )
  );
}
