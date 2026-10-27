import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Page, Feedback } from "@/components/BetaLayout";
import {
  checkoutStorageKey,
  mayReviewRejectedCheckout,
} from "@/lib/checkout-policy";
import { getNativeApiOrigin } from "@/lib/api-fetch";
export default function Checkout() {
  const { user } = useAuth({ redirectOnUnauthenticated: true });
  const [, navigate] = useLocation();
  const utils = trpc.useUtils();
  const quote = trpc.cart.quote.useQuery(undefined, { enabled: !!user });
  const addresses = trpc.addresses.list.useQuery(undefined, {
    enabled: !!user,
  });
  const [addressId, setAddressId] = useState("");
  const [contactName, setName] = useState("");
  const [contactPhone, setPhone] = useState("");
  const [ack, setAck] = useState(false);
  // Preserve the request and key on ambiguous network failure, including navigation/reload.
  type Pending = {
    addressId: number;
    contactName: string;
    contactPhone: string;
    expectedTotal: string;
    expectedCartHash: string;
    paymentMethod: "cash";
    simulationAcknowledged: true;
    idempotencyKey: string;
  };
  const [pending, setPending] = useState<Pending | null>(null);
  const storageKey = user
    ? checkoutStorageKey(user.id, getNativeApiOrigin())
    : null;
  useEffect(() => {
    if (user) {
      try {
        setPending(JSON.parse(sessionStorage.getItem(storageKey!) ?? "null"));
      } catch {
        setPending(null);
      }
    }
  }, [storageKey]);
  const create = trpc.orders.create.useMutation({
    onSuccess: async order => {
      if (storageKey) sessionStorage.removeItem(storageKey);
      setPending(null);
      await utils.cart.invalidate();
      await utils.orders.invalidate();
      navigate(`/order/${order.orderId}`);
    },
  });
  const submit = () => {
    if (!user || !quote.data) return;
    const request = pending ?? {
      addressId: Number(addressId),
      contactName,
      contactPhone,
      expectedTotal: quote.data.total,
      expectedCartHash: quote.data.fingerprint,
      paymentMethod: "cash" as const,
      simulationAcknowledged: true as const,
      idempotencyKey: crypto.randomUUID(),
    };
    setPending(request);
    sessionStorage.setItem(storageKey!, JSON.stringify(request));
    create.mutate(request);
  };
  const reset = () => {
    if (storageKey) sessionStorage.removeItem(storageKey);
    setPending(null);
    create.reset();
    quote.refetch();
  };
  return (
    <Page title="تأكيد طلب محاكاة">
      <Feedback
        loading={quote.isLoading || addresses.isLoading}
        error={quote.error ?? addresses.error ?? create.error}
      />
      {quote.data?.items.map(item => (
        <p key={item.id}>
          {item.name} × {item.quantity}: {item.lineTotal} JD
        </p>
      ))}
      {quote.data && (
        <p className="font-bold">
          الإجمالي من الخادم: {quote.data.total} JD (شحن 0.00، ضريبة 0.00)
        </p>
      )}
      {pending ? (
        <div className="space-y-3">
          <p>
            يوجد إرسال محفوظ. أعد المحاولة بالمفتاح نفسه لاسترجاع الطلب دون
            تكراره.
          </p>
          <Button disabled={create.isPending} onClick={submit}>
            إعادة المحاولة بأمان
          </Button>
          {mayReviewRejectedCheckout(create.error?.data?.code) && (
            <Button variant="outline" onClick={reset}>
              مراجعة السلة وتصحيح البيانات
            </Button>
          )}
        </div>
      ) : (
        <form
          className="space-y-4 max-w-lg"
          onSubmit={e => {
            e.preventDefault();
            submit();
          }}
        >
          <label className="block">
            عنوان خيالي
            <select
              required
              value={addressId}
              onChange={e => setAddressId(e.target.value)}
              className="block border p-2 rounded w-full"
            >
              <option value="">اختر العنوان</option>
              {addresses.data?.map(address => (
                <option key={address.id} value={address.id}>
                  {address.label}: {address.address}
                </option>
              ))}
            </select>
          </label>
          {!addresses.data?.length && (
            <Link href="/profile">أضف عنوان اختبار في حسابك</Link>
          )}
          <label className="block">
            اسم المستلم الخيالي
            <Input
              required
              minLength={2}
              maxLength={100}
              value={contactName}
              onChange={e => setName(e.target.value)}
            />
          </label>
          <label className="block">
            رقم اختبار
            <Input
              required
              pattern="[+0-9 ()-]{6,30}"
              value={contactPhone}
              onChange={e => setPhone(e.target.value)}
            />
          </label>
          <label className="flex gap-3">
            <input
              required
              type="checkbox"
              checked={ack}
              onChange={e => setAck(e.target.checked)}
            />
            أفهم أن الطلب محاكاة بلا دفع أو توصيل وأن البيانات خيالية.
          </label>
          <Button
            type="submit"
            disabled={
              !quote.data?.items.length ||
              quote.data.items.some(item => !item.available) ||
              create.isPending ||
              !ack
            }
          >
            تأكيد الطلب التجريبي
          </Button>
        </form>
      )}
    </Page>
  );
}
