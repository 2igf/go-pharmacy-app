import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { Feedback } from "@/components/BetaLayout";
import PromotionalCarousel from "@/customer/PromotionalCarousel";
import {
  DeliveryAddress,
  ProductCard,
  UnavailableControl,
} from "@/customer/CustomerPieces";

const categories = [
  ["medications", "الادوية", "medications"],
  ["natural", "منتجات طبيعية", "natural_products"],
  ["skincare", "العناية بالبشر", "skincare"],
  ["baby", "الأم والطفل", "baby_care"],
  ["supplies", "مستلزمات طبيه", "medical_supplies"],
  ["pets", "أليف", null],
] as const;

export default function Home() {
  const products = trpc.products.list.useQuery({ limit: 100, offset: 0 });
  const medicines =
    products.data?.filter(p => p.category === "medications") ?? [];
  const supplies =
    products.data?.filter(p => p.category === "medical_supplies") ?? [];
  return (
    <main className="canva-home">
      <DeliveryAddress label="" scan />
      <section className="canva-categories">
        <h1>الأقسام</h1>
        <div>
          {categories.map(([icon, label, category]) =>
            category ? (
              <Link key={icon} href={`/products?category=${category}`}>
                <img src={`/canva/category-${icon}.png`} alt="" />
                <span>{label}</span>
              </Link>
            ) : (
              <UnavailableControl
                key={icon}
                label={label}
                message="قسم المنتجات البيطرية غير متاح حاليًا."
              >
                <img src={`/canva/category-${icon}.png`} alt="" />
                <span>{label}</span>
              </UnavailableControl>
            )
          )}
        </div>
      </section>
      <section
        className="canva-doctor-banner"
        aria-label="كشف عيادة — غير متاح حاليًا"
      >
        <img src="/canva/doctor.png" alt="صورة الطبيب من التصميم الأصلي" />
        <div>
          <h2>كشف عيادة</h2>
          <p>قارن و اختر و احجز دكتور في التخصص الذي تحتاجه</p>
          <div>
            <UnavailableControl label="أحجز موعد" />
            <UnavailableControl label="أستشارات طبيب" />
          </div>
          <small>الخدمات الطبية غير متاحة في النسخة التجريبية</small>
        </div>
      </section>
      <Feedback loading={products.isLoading} error={products.error} />
      <section className="canva-home-products">
        <h2>الادوية</h2>
        {medicines.length ? (
          <div className="canva-three-products">
            {medicines.slice(0, 3).map(p => (
              <ProductCard key={p.id} product={{ ...p, imageUrl: p.image }} />
            ))}
          </div>
        ) : (
          !products.isLoading && (
            <p className="canva-empty">
              لا توجد أدوية متاحة في الكتالوج الحالي.
            </p>
          )
        )}
      </section>
      <section className="canva-home-products">
        <h2>مستلزمات طبيه</h2>
        {supplies.length ? (
          <div className="canva-three-products">
            {supplies.slice(0, 3).map(p => (
              <ProductCard key={p.id} product={{ ...p, imageUrl: p.image }} />
            ))}
          </div>
        ) : (
          !products.isLoading && (
            <p className="canva-empty">لا توجد مستلزمات في الكتالوج الحالي.</p>
          )
        )}
      </section>
      <PromotionalCarousel />
      <Link className="canva-catalog-link" href="/products?view=all">
        عرض جميع المنتجات والبحث
      </Link>
    </main>
  );
}
