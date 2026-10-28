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
import {
  checkoutSchema,
  checkoutPhonePattern,
  checkoutValidationIssues,
  parsePendingCheckout,
  type CheckoutRequest,
} from "@shared/checkout";
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
  const [pending, setPending] = useState<CheckoutRequest | null>(null);
  const [invalidSaved, setInvalidSaved] = useState(false);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const storageKey = user
    ? checkoutStorageKey(user.id, getNativeApiOrigin())
    : null;
  useEffect(() => {
    if (user) {
      try {
        const saved = sessionStorage.getItem(storageKey!);
        const restored = parsePendingCheckout(saved);
        setPending(restored);
        setInvalidSaved(!!saved && !restored);
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
    if (invalidSaved) return;
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
    const parsed = checkoutSchema.safeParse(request);
    if (!parsed.success) {
      setValidationErrors(
        checkoutValidationIssues(parsed.error.issues).map(
          issue => issue.message
        )
      );
      return;
    }
    setValidationErrors([]);
    setPending(parsed.data);
    sessionStorage.setItem(storageKey!, JSON.stringify(parsed.data));
    create.mutate(parsed.data);
  };
  const reset = () => {
    if (storageKey) sessionStorage.removeItem(storageKey);
    setPending(null);
    setInvalidSaved(false);
    setValidationErrors([]);
    create.reset();
    quote.refetch();
  };
  return (
    <Page title="تأكيد طلب محاكاة">
      <Feedback
        loading={quote.isLoading || addresses.isLoading}
        error={quote.error ?? addresses.error ?? create.error}
      />
      {validationErrors.length > 0 && (
        <ul role="alert" className="text-red-700">
          {validationErrors.map(message => (
            <li key={message}>{message}</li>
          ))}
        </ul>
      )}
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
      {invalidSaved ? (
        <div role="alert" className="space-y-3">
          <p>
            بيانات الإرسال المحفوظ غير صالحة. راجع طلباتك قبل بدء إرسال جديد.
          </p>
          <Link href="/profile">مراجعة الطلبات</Link>
          <Button variant="outline" onClick={reset}>
            مراجعة السلة وتصحيح البيانات
          </Button>
        </div>
      ) : pending ? (
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
              onInvalid={e =>
                e.currentTarget.setCustomValidity(
                  checkoutValidationIssues([
                    { path: ["addressId"], code: "invalid_format" },
                  ])[0].message
                )
              }
              onChange={e => {
                e.target.setCustomValidity("");
                setAddressId(e.target.value);
              }}
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
              onInvalid={e =>
                e.currentTarget.setCustomValidity(
                  checkoutValidationIssues([
                    { path: ["contactName"], code: "invalid_format" },
                  ])[0].message
                )
              }
              onChange={e => {
                e.target.setCustomValidity("");
                setName(e.target.value);
              }}
            />
          </label>
          <label className="block">
            رقم اختبار
            <Input
              required
              pattern={checkoutPhonePattern}
              inputMode="tel"
              maxLength={30}
              value={contactPhone}
              onInvalid={e =>
                e.currentTarget.setCustomValidity(
                  checkoutValidationIssues([
                    { path: ["contactPhone"], code: "invalid_format" },
                  ])[0].message
                )
              }
              onChange={e => {
                e.target.setCustomValidity("");
                setPhone(e.target.value);
              }}
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
