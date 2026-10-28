import { Link, useRoute } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Page, Feedback } from "@/components/BetaLayout";
import { fulfillmentLabels } from "@shared/fulfillment";
import { visibleCustomerOrder } from "@/lib/checkout-policy";
export default function OrderTracking() {
  const { user, loading: authLoading } = useAuth({
    redirectOnUnauthenticated: true,
  });
  const [, params] = useRoute("/order/:id");
  const id = Number(
    params?.id ?? new URLSearchParams(location.search).get("id")
  );
  const order = trpc.orders.byId.useQuery(
    { id },
    { enabled: Number.isInteger(id) && id > 0 && !!user, refetchInterval: 5000 }
  );
  const currentOrder = visibleCustomerOrder(order.data, user?.id, order.error);
  if (authLoading)
    return (
      <Page title="تأكيد الطلب وتتبع الحالة">
        <Feedback loading />
      </Page>
    );
  return (
    <Page title="تأكيد الطلب وتتبع الحالة">
      <Feedback loading={order.isLoading} error={order.error} />
      {currentOrder ? (
        <article className="bg-white border p-5 rounded-xl space-y-3">
          <h2 className="font-bold">{currentOrder.orderNumber}</h2>
          <p>
            {currentOrder.isSimulated
              ? "طلب محاكاة محفوظ — لا دفع أو توصيل"
              : "سجل سابق"}
          </p>
          <p>
            الحالة الحالية: <strong>{currentOrder.status}</strong>
          </p>
          {currentOrder.fulfillment && (
            <p>
              تنفيذ الصيدلية:{" "}
              <strong>
                {fulfillmentLabels[currentOrder.fulfillment.state]}
              </strong>
              {currentOrder.fulfillment.pharmacyName
                ? ` — ${currentOrder.fulfillment.pharmacyName}`
                : ""}
            </p>
          )}
          {currentOrder.items.map(item => (
            <p key={item.id}>
              {item.productName ?? `منتج #${item.productId}`} × {item.quantity}{" "}
              — سعر الوحدة {item.price} JD
            </p>
          ))}
          <p>الإجمالي: {currentOrder.totalAmount} JD</p>
          <p>العنوان الخيالي: {currentOrder.deliveryAddress}</p>
        </article>
      ) : (
        !order.isLoading && !order.error && <p>الطلب غير موجود</p>
      )}
      <Link href="/profile">كل طلباتي</Link>
    </Page>
  );
}
