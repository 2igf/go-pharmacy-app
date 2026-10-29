import { useEffect, useState } from "react";
import { useSearch } from "wouter";
import { trpc } from "@/lib/trpc";
import { Feedback } from "@/components/BetaLayout";
import {
  ProductCard,
  SearchField,
  UnavailableControl,
} from "@/customer/CustomerPieces";
import { filterCatalog } from "@/customer/policy";
const categories = [
  ["all", "جميع الفئات"],
  ["medications", "الأدوية"],
  ["natural_products", "منتجات طبيعية"],
  ["skincare", "العناية بالبشرة"],
  ["baby_care", "العناية بالأطفال"],
  ["medical_supplies", "مستلزمات طبية"],
];
const brands = [
  ["beesline", "Beesline"],
  ["gillette", "Gillette"],
  ["dove", "Dove"],
  ["pampers", "Pampers"],
  ["babyjoy", "BabyJoy"],
];
const clinics = [
  ["skin", "جلدية"],
  ["teeth", "أسنان"],
  ["bones", "عظام"],
  ["child", "أطفال"],
  ["internal", "باطنيه"],
];
export default function ProductsPage() {
  const search = useSearch();
  const [searchQuery, setSearchQuery] = useState(
    new URLSearchParams(location.search).get("search") ?? ""
  );
  const [selectedCategory, setCategory] = useState(
    new URLSearchParams(location.search).get("category") ?? "all"
  );
  const [sortBy, setSort] = useState("name");
  const [searching, setSearching] = useState(
    new URLSearchParams(location.search).get("view") === "all"
  );
  const products = trpc.products.list.useQuery({ limit: 100, offset: 0 });
  useEffect(() => {
    const params = new URLSearchParams(search);
    setCategory(params.get("category") ?? "all");
    setSearchQuery(params.get("search") ?? "");
    setSearching(params.get("view") === "all");
  }, [search]);
  const filtered = filterCatalog(
    products.data ?? [],
    searchQuery,
    selectedCategory
  ).sort((a, b) =>
    sortBy === "price_low"
      ? Number(a.price) - Number(b.price)
      : sortBy === "price_high"
        ? Number(b.price) - Number(a.price)
        : a.name.localeCompare(b.name, "ar")
  );
  const results =
    !!searchQuery.trim() || selectedCategory !== "all" || searching;
  return (
    <main className="canva-discovery">
      <h1 className="sr-only">الأدوية والمنتجات</h1>
      <SearchField
        value={searchQuery}
        onChange={setSearchQuery}
        onSubmit={() => setSearching(true)}
      />
      <Feedback loading={products.isLoading} error={products.error} />
      <section className="canva-popular">
        <h2>{results ? "نتائج البحث" : "الأكثر رواجاً"}</h2>
        {!results && (
          <p className="canva-data-note">
            من الكتالوج الحالي — لا تتوفر إحصاءات رواج
          </p>
        )}
        {filtered.length ? (
          <div
            className={results ? "canva-results-grid" : "canva-four-products"}
          >
            {(results ? filtered : filtered.slice(0, 4)).map(product => (
              <ProductCard
                key={product.id}
                product={{ ...product, imageUrl: product.image }}
              />
            ))}
          </div>
        ) : (
          !products.isLoading && (
            <p className="canva-empty">لم يتم العثور على منتجات</p>
          )
        )}
      </section>
      {!results && (
        <button
          type="button"
          className="canva-show-catalog"
          onClick={() => setSearching(true)}
        >
          عرض جميع المنتجات
        </button>
      )}
      <section className="canva-brands">
        <h2>ماركات مميزة</h2>
        <div>
          {brands.map(([icon, name]) => (
            <button
              key={icon}
              type="button"
              aria-label={`بحث عن ${name}`}
              onClick={() => {
                setSearchQuery(name);
                setCategory("all");
                setSearching(true);
                window.scrollTo({ top: 0, behavior: "smooth" });
              }}
            >
              <img src={`/canva/brand-${icon}.png`} alt={name} />
            </button>
          ))}
        </div>
      </section>
      <section className="canva-clinics">
        <h2>عيادات الأكثر رواجاً</h2>
        <div>
          {clinics.map(([icon, label]) => (
            <UnavailableControl key={icon} label={`عيادة ${label}`}>
              <img src={`/canva/clinic-${icon}.png`} alt="" />
              <span>{label}</span>
            </UnavailableControl>
          ))}
        </div>
        <p className="canva-data-note">العيادات والحجوزات غير متاحة حاليًا</p>
      </section>
      <figure className="canva-advert">
        <img
          src="/canva/banner-dozova.png"
          alt="بنر Dozova من تصميم Canva الأصلي — مادة بصرية مرجعية فقط"
        />
        <figcaption>
          من التصميم الأصلي — لا يمثل عرضًا أو توفرًا للبيع
        </figcaption>
      </figure>
      <details className="canva-search-options">
        <summary>خيارات البحث والترتيب</summary>
        <label>
          الفئة
          <select
            aria-label="الفئة"
            value={selectedCategory}
            onChange={e => setCategory(e.target.value)}
          >
            {categories.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label>
          الترتيب
          <select
            aria-label="الترتيب"
            value={sortBy}
            onChange={e => setSort(e.target.value)}
          >
            <option value="name">الاسم: أ-ي</option>
            <option value="price_low">السعر: الأقل أولاً</option>
            <option value="price_high">السعر: الأعلى أولاً</option>
          </select>
        </label>
        <button
          type="button"
          onClick={() => {
            setSearchQuery("");
            setCategory("all");
            setSearching(false);
          }}
        >
          مسح البحث
        </button>
      </details>
    </main>
  );
}
