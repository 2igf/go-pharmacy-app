import { useState } from "react";
import { Link } from "wouter";
import { ShoppingCart } from "lucide-react";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { productArtwork, ownedCustomerRecords } from "./policy";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

export function ProductImage({
  product,
  className = "",
}: {
  product: { name: string; imageUrl?: string | null };
  className?: string;
}) {
  const src = productArtwork(product);
  const [failed, setFailed] = useState<string | null>(null);
  return src && failed !== src ? (
    <img
      className={`canva-product-image ${className}`}
      src={src}
      alt={product.name}
      onError={() => setFailed(src)}
    />
  ) : (
    <span
      className={`canva-image-missing ${className}`}
      role="img"
      aria-label={`لا توجد صورة أصلية: ${product.name}`}
    >
      صورة المنتج
      <br />
      غير متاحة
    </span>
  );
}

export function DeliveryAddress({
  label = "عنوان التوصيل",
  scan = false,
}: {
  label?: string;
  scan?: boolean;
}) {
  const { user } = useAuth();
  const addresses = trpc.addresses.list.useQuery(undefined, {
    enabled: !!user,
  });
  return (
    <header className={`canva-delivery ${scan ? "with-scan" : ""}`}>
      <Link
        href={user ? "/addresses" : "/login"}
        className="canva-address"
        aria-label="اختيار عنوان التوصيل"
      >
        <img className="canva-pin" src="/canva/pin.png" alt="" />
        <span>
          {label && <strong>{label}</strong>}
          <span>
            {addresses.isError
              ? "تعذر تحميل العنوان — أعد المحاولة"
              : ownedCustomerRecords(
                  addresses.data,
                  user?.id,
                  addresses.error
                )[0]?.address || "اختر عنوان التوصيل"}
          </span>
        </span>
      </Link>
      {scan && (
        <UnavailableControl
          className="canva-scan"
          label="مسح رمز المنتج"
          message="مسح الرموز غير متاح حاليًا. استخدم البحث عن المنتجات."
        >
          <img src="/canva/scan.png" alt="" />
        </UnavailableControl>
      )}
    </header>
  );
}

export function UnavailableControl({
  label,
  message,
  className = "",
  children,
}: {
  label: string;
  message?: string;
  className?: string;
  children?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        className={className}
        onClick={() => setOpen(true)}
        aria-label={`${label} — غير متاح حاليًا`}
      >
        {children ?? label}
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent dir="rtl">
          <DialogTitle>{label}</DialogTitle>
          <DialogDescription>
            {message ??
              "هذه الخدمة غير متاحة في النسخة التجريبية. لا تدخل معلومات طبية."}
          </DialogDescription>
          <button type="button" onClick={() => setOpen(false)}>
            إغلاق
          </button>
        </DialogContent>
      </Dialog>
    </>
  );
}

export type CatalogProduct = {
  id: number;
  name: string;
  price: string;
  stock: number;
  category: string;
  requiresPrescription: boolean;
  imageUrl?: string | null;
};
export function ProductCard({ product }: { product: CatalogProduct }) {
  return (
    <article className="canva-product-card">
      <Link
        href={`/product/${product.id}`}
        className="canva-product-photo"
        aria-label={`تفاصيل ${product.name}`}
      >
        <ProductImage product={product} />
      </Link>
      <div className="canva-product-summary">
        <Link href={`/product/${product.id}`}>{product.name}</Link>
        <Link
          href={`/product/${product.id}`}
          className="canva-small-cart"
          aria-label={`عرض وإضافة ${product.name}`}
        >
          <ShoppingCart aria-hidden="true" />
          <small>أضف إلى العربة</small>
        </Link>
        <p>
          <span>السعر :</span> <bdi>{product.price} JD</bdi>
        </p>
      </div>
      <Link
        href={`/product/${product.id}`}
        className={`canva-product-action ${product.requiresPrescription ? "prescription" : ""}`}
      >
        {product.requiresPrescription
          ? "يلزم وصفة طبية — غير متاح"
          : product.stock > 0
            ? "اطلب الآن"
            : "غير متوفر"}
      </Link>
    </article>
  );
}

export function SearchField({
  value,
  onChange,
  onSubmit,
}: {
  value: string;
  onChange: (value: string) => void;
  onSubmit?: () => void;
}) {
  return (
    <form
      className="canva-search"
      role="search"
      onSubmit={e => {
        e.preventDefault();
        onSubmit?.();
      }}
    >
      <button aria-label="بحث المنتجات" type="submit">
        <img src="/canva/nav-search.png" alt="" />
      </button>
      <input
        type="search"
        aria-label="بحث المنتجات"
        placeholder="ابحث عن دواء، اسم عيادة أو طبيب"
        value={value}
        onChange={e => onChange(e.target.value)}
      />
    </form>
  );
}
