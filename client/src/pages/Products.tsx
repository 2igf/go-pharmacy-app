import { useEffect, useState } from "react";
import { Link, useSearch } from "wouter";
import { trpc } from "@/lib/trpc";
import { Feedback } from "@/components/BetaLayout";
import PromotionalCarousel from "@/customer/PromotionalCarousel";
import {
  ProductCard,
  SearchField,
  UnavailableControl,
} from "@/customer/CustomerPieces";
const categories = [
  ["all", "جميع الفئات"],
  ["medications", "الأدوية"],
  ["natural_products", "منتجات طبيعية"],
  ["skincare", "العناية بالبشرة"],
  ["baby_care", "العناية بالأطفال"],
  ["medical_supplies", "مستلزمات طبية"],
  ["pet_care", "العناية بالحيوانات الأليفة"],
] as const;
type Category = (typeof categories)[number][0];
function catalogCategory(value: string | null): Category {
  return categories.find(([category]) => category === value)?.[0] ?? "all";
}
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
  const [selectedCategory, setCategory] = useState<Category>(
    catalogCategory(new URLSearchParams(location.search).get("category"))
  );
  const [sortBy, setSort] = useState<"name" | "price_low" | "price_high">(
    "name"
  );
  const [page, setPage] = useState(0);
  const [searching, setSearching] = useState(
    new URLSearchParams(location.search).get("view") === "all"
  );
  const products = trpc.products.browse.useQuery({
    query: searchQuery,
    category: selectedCategory,
    sort: sortBy,
    limit: 20,
    offset: page * 20,
  });
  useEffect(() => {
    const params = new URLSearchParams(search);
    setCategory(catalogCategory(params.get("category")));
    setSearchQuery(params.get("search") ?? "");
    setSearching(params.get("view") === "all");
    setPage(0);
  }, [search]);
  const filtered = products.error ? [] : (products.data?.items ?? []);
  const results =
    !!searchQuery.trim() || selectedCategory !== "all" || searching;
  return (
    <main className="canva-discovery">
      <h1 className="sr-only">الأدوية والمنتجات</h1>
      <SearchField
        value={searchQuery}
        onChange={value => {
          setSearchQuery(value);
          setPage(0);
        }}
        onSubmit={() => setSearching(true)}
      />
      <Link className="canva-knowledge-entry" href="/medicines">
        دليل معلومات الأدوية — المصادر والتسجيل
      </Link>
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
          !products.isLoading &&
          !products.error && (
            <p className="canva-empty">لم يتم العثور على منتجات</p>
          )
        )}
        {results && !products.error && (
          <nav aria-label="صفحات المنتجات" className="canva-catalog-pagination">
            <button
              type="button"
              disabled={page === 0 || products.isFetching}
              onClick={() => setPage(current => Math.max(0, current - 1))}
            >
              السابق
            </button>
            <span aria-live="polite">صفحة {page + 1}</span>
            <button
              type="button"
              disabled={!products.data?.hasMore || products.isFetching}
              onClick={() => setPage(current => current + 1)}
            >
              التالي
            </button>
          </nav>
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
                setPage(0);
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
      <PromotionalCarousel />
      <details className="canva-search-options">
        <summary>خيارات البحث والترتيب</summary>
        <label>
          الفئة
          <select
            aria-label="الفئة"
            value={selectedCategory}
            onChange={e => {
              setCategory(catalogCategory(e.target.value));
              setPage(0);
            }}
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
            onChange={e => {
              setSort(e.target.value as typeof sortBy);
              setPage(0);
            }}
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
            setPage(0);
          }}
        >
          مسح البحث
        </button>
      </details>
    </main>
  );
}
