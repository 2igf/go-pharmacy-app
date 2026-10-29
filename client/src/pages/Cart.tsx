import { useState } from "react";
import { Link, useLocation } from "wouter";
import { ChevronLeft, CirclePlus, Clock3, X } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Feedback } from "@/components/BetaLayout";
import { DeliveryAddress, ProductImage } from "@/customer/CustomerPieces";
import { ownedCustomerRecords, ownedCustomerQuote } from "@/customer/policy";
import "@/customer/cart.css";

function CartProductImage({ id, name }: { id: number; name: string }) {
  const product = trpc.products.byId.useQuery({ id });
  return (
    <ProductImage
      product={{ name, imageUrl: product.data?.image }}
      className="canva-cart-product-image"
    />
  );
}

export default function Cart() {
  const { user } = useAuth({ redirectOnUnauthenticated: true });
  const utils = trpc.useUtils();
  const [, navigate] = useLocation();
  const quote = trpc.cart.quote.useQuery(undefined, { enabled: !!user });
  const visibleQuote = ownedCustomerQuote(quote.data, user?.id, quote.error);
  const onSuccess = () => utils.cart.invalidate();
  const update = trpc.cart.updateQuantity.useMutation({ onSuccess });
  const remove = trpc.cart.remove.useMutation({ onSuccess });
  const pending = update.isPending || remove.isPending;
  const addresses = trpc.addresses.list.useQuery(undefined, {
    enabled: !!user,
  });
  const [showAddresses, setShowAddresses] = useState(true);
  const visibleAddresses = ownedCustomerRecords(
    addresses.data,
    user?.id,
    addresses.error
  );
  return (
    <main className="canva-cart" dir="rtl">
      <h1 className="sr-only">سلة التسوق التجريبية</h1>
      <div className="canva-cart-address-trigger">
        <DeliveryAddress />
      </div>
      <div className="canva-cart-feedback">
        <Feedback
          loading={quote.isLoading}
          error={quote.error ?? update.error ?? remove.error ?? addresses.error}
        />
      </div>
      <section className="canva-cart-items" aria-label="منتجات السلة">
        {visibleQuote?.items.map(item => (
          <article key={item.id} className="canva-cart-row">
            <Link
              className="canva-cart-image-link"
              href={`/product?id=${item.productId}`}
              aria-label={item.name}
            >
              <CartProductImage id={item.productId} name={item.name} />
            </Link>
            <div className="canva-cart-row-content">
              <div className="canva-cart-row-heading">
                <Link href={`/product?id=${item.productId}`} title={item.name}>
                  {item.name}
                </Link>
                <p className="canva-cart-price">
                  <span>السعر :</span> <bdi>{item.price} JD</bdi>
                </p>
              </div>
              <p className="canva-cart-delivery-note">
                <Clock3 aria-hidden="true" /> لا توصيل في المحاكاة
              </p>
              {!item.available && (
                <p role="alert" className="canva-cart-unavailable">
                  غير متاح — احذف المنتج أو عدل الكمية قبل المتابعة
                </p>
              )}
              <div className="canva-cart-quantity" dir="ltr">
                <Button
                  aria-label={`تقليل ${item.name}`}
                  disabled={pending || item.quantity <= 1}
                  onClick={() =>
                    update.mutate({ id: item.id, quantity: item.quantity - 1 })
                  }
                >
                  −
                </Button>
                <span aria-label="الكمية">{item.quantity}</span>
                <Button
                  aria-label={`زيادة ${item.name}`}
                  disabled={
                    pending || item.quantity >= Math.min(item.stock, 99)
                  }
                  onClick={() =>
                    update.mutate({ id: item.id, quantity: item.quantity + 1 })
                  }
                >
                  +
                </Button>
              </div>
              <button
                type="button"
                className="canva-cart-remove"
                disabled={pending}
                onClick={() => remove.mutate({ id: item.id })}
                aria-label={`حذف ${item.name}`}
              >
                حذف
              </button>
              <span className="sr-only">
                إجمالي المنتج: {item.lineTotal} JD
              </span>
            </div>
          </article>
        ))}
      </section>
      <section className="canva-cart-sheet" aria-label="العنوان والدفع">
        {!showAddresses && (
          <button
            type="button"
            className="canva-cart-show-addresses"
            onClick={() => setShowAddresses(true)}
          >
            العناوين المحفوظة
          </button>
        )}
        {showAddresses && (
          <div id="cart-saved-addresses" className="canva-cart-saved-addresses">
            <div className="canva-cart-sheet-heading">
              <h2>العناوين المحفوظة</h2>
              <button
                type="button"
                className="canva-cart-close"
                aria-label="إغلاق العناوين المحفوظة"
                onClick={() => setShowAddresses(false)}
              >
                <X aria-hidden="true" />
              </button>
            </div>
            {addresses.isLoading && <p role="status">جار تحميل العناوين…</p>}
            {visibleAddresses.slice(0, 1).map(address => (
              <div className="canva-cart-saved-address" key={address.id}>
                <h3>{address.label || "عنوان التوصيل"}</h3>
                <p>{address.address}</p>
              </div>
            ))}
            {visibleAddresses.length > 1 && (
              <Link className="canva-cart-all-addresses" href="/profile">
                عرض كل العناوين ({visibleAddresses.length})
              </Link>
            )}
            {!addresses.isLoading &&
              !addresses.error &&
              !visibleAddresses.length && <p>لا توجد عناوين محفوظة</p>}
          </div>
        )}
        <div className="canva-cart-map">
          <div>
            <Link href="/profile">التوصيل إلى عنوان آخر</Link>
            <button type="button" disabled>
              اختر موقعاً على الخريطة — غير متاح
            </button>
          </div>
          <ChevronLeft aria-hidden="true" />
        </div>
        {visibleQuote && (
          <>
            <div className="canva-cart-payment-panel">
              <div className="canva-cart-total">
                <h2>المبلغ الإجمالي</h2>
                <p>
                  <bdi>{visibleQuote.total} JD</bdi>
                </p>
              </div>
              <div className="canva-cart-payment">
                <h2>الدفع من خلال</h2>
                <div>
                  <span>
                    <CirclePlus aria-hidden="true" /> نقداً
                  </span>
                  <button type="button" disabled>
                    <CirclePlus aria-hidden="true" /> بطاقة
                  </button>
                </div>
              </div>
              <p className="canva-cart-payment-note">
                الشحن والضريبة في المحاكاة: 0.00 JD — البطاقة غير متاحة، لا دفع
                حقيقي
              </p>
            </div>
            {visibleQuote.items.length ? (
              <Button
                className="canva-cart-action"
                disabled={
                  pending || visibleQuote.items.some(item => !item.available)
                }
                onClick={() => navigate("/checkout")}
              >
                متابعة الطلب التجريبي
              </Button>
            ) : (
              <p className="canva-cart-empty">
                السلة فارغة. <Link href="/products">تصفح المنتجات</Link>
              </p>
            )}
          </>
        )}
      </section>
    </main>
  );
}
