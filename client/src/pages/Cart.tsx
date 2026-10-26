import { Link, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Page, Feedback } from "@/components/BetaLayout";
export default function Cart() {
  const { user } = useAuth({ redirectOnUnauthenticated: true });
  const utils = trpc.useUtils();
  const [, navigate] = useLocation();
  const quote = trpc.cart.quote.useQuery(undefined, { enabled: !!user });
  const onSuccess = () => utils.cart.invalidate();
  const update = trpc.cart.updateQuantity.useMutation({ onSuccess });
  const remove = trpc.cart.remove.useMutation({ onSuccess });
  const pending = update.isPending || remove.isPending;
  return (
    <Page title="سلة التسوق التجريبية">
      <Feedback
        loading={quote.isLoading}
        error={quote.error ?? update.error ?? remove.error}
      />
      {quote.data?.items.map(item => (
        <article
          key={item.id}
          className="border rounded-xl p-4 space-y-3 bg-white"
        >
          <Link href={`/product?id=${item.productId}`}>{item.name}</Link>
          <p>
            {item.price} JD × {item.quantity} = {item.lineTotal} JD
          </p>
          {!item.available && (
            <p role="alert">
              غير متاح — احذف المنتج أو عدل الكمية قبل المتابعة
            </p>
          )}
          <div className="flex gap-3">
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
              disabled={pending || item.quantity >= Math.min(item.stock, 99)}
              onClick={() =>
                update.mutate({ id: item.id, quantity: item.quantity + 1 })
              }
            >
              +
            </Button>
            <Button
              variant="outline"
              disabled={pending}
              onClick={() => remove.mutate({ id: item.id })}
            >
              حذف
            </Button>
          </div>
        </article>
      ))}
      {quote.data && (
        <>
          <p>
            المجموع: {quote.data.total} JD — الشحن والضريبة في المحاكاة: 0.00 JD
          </p>
          {quote.data.items.length ? (
            <Button
              disabled={
                pending || quote.data.items.some(item => !item.available)
              }
              onClick={() => navigate("/checkout")}
            >
              متابعة الطلب التجريبي
            </Button>
          ) : (
            <p>
              السلة فارغة. <Link href="/products">تصفح المنتجات</Link>
            </p>
          )}
        </>
      )}
    </Page>
  );
}
