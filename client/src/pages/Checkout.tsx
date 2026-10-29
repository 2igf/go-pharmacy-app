import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { ChevronLeft, CirclePlus } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Feedback } from "@/components/BetaLayout";
import { DeliveryAddress } from "@/customer/CustomerPieces";
import "@/customer/cart.css";
import { ownedCustomerRecords, ownedCustomerQuote } from "@/customer/policy";
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
    // A new request must not use a previous account's cached quote. Saved retries retain their original key/payload.
    if (!pending && !ownedCustomerQuote(quote.data, user.id, quote.error))
      return;
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
  const visibleQuote = ownedCustomerQuote(quote.data, user?.id, quote.error);
  const visibleAddresses = ownedCustomerRecords(
    addresses.data,
    user?.id,
    addresses.error
  );
  return (
    <main className="canva-cart canva-checkout" dir="rtl">
      <div className="canva-cart-address-trigger">
        <DeliveryAddress />
      </div>
      <h1 className="canva-checkout-title">تأكيد طلب محاكاة</h1>
      <div className="canva-cart-feedback">
        <Feedback
          loading={quote.isLoading || addresses.isLoading}
          error={quote.error ?? addresses.error ?? create.error}
        />
      </div>
      {validationErrors.length > 0 && (
        <ul role="alert" className="canva-checkout-errors text-red-700">
          {validationErrors.map(message => (
            <li key={message}>{message}</li>
          ))}
        </ul>
      )}
      <section className="canva-checkout-summary" aria-label="ملخص الطلب">
        {visibleQuote?.items.map(item => (
          <p className="canva-checkout-summary-row" key={item.id}>
            {item.name} × {item.quantity}: {item.lineTotal} JD
          </p>
        ))}
        {visibleQuote && (
          <p className="canva-checkout-server-total">
            الإجمالي من الخادم: {visibleQuote.total} JD (شحن 0.00، ضريبة 0.00)
          </p>
        )}
      </section>
      {invalidSaved ? (
        <div role="alert" className="canva-checkout-recovery space-y-3">
          <p>
            بيانات الإرسال المحفوظ غير صالحة. راجع طلباتك قبل بدء إرسال جديد.
          </p>
          <Link href="/profile">مراجعة الطلبات</Link>
          <Button variant="outline" onClick={reset}>
            مراجعة السلة وتصحيح البيانات
          </Button>
        </div>
      ) : pending ? (
        <div className="canva-checkout-recovery space-y-3">
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
          className="canva-checkout-form"
          onSubmit={e => {
            e.preventDefault();
            submit();
          }}
        >
          <section className="canva-checkout-address-panel">
            <h2>العناوين المحفوظة</h2>
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
                {visibleAddresses.map(address => (
                  <option key={address.id} value={address.id}>
                    {address.label}: {address.address}
                  </option>
                ))}
              </select>
            </label>
            {!visibleAddresses.length && (
              <Link href="/profile">أضف عنوان اختبار في حسابك</Link>
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
            <div className="canva-checkout-contact">
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
            </div>
          </section>
          {visibleQuote && (
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
          )}
          <label className="canva-checkout-ack">
            <input
              required
              type="checkbox"
              checked={ack}
              onChange={e => setAck(e.target.checked)}
            />
            أفهم أن الطلب محاكاة بلا دفع أو توصيل وأن البيانات خيالية.
          </label>
          <Button
            className="canva-cart-action"
            type="submit"
            disabled={
              !visibleQuote?.items.length ||
              visibleQuote.items.some(item => !item.available) ||
              create.isPending ||
              !ack
            }
          >
            تأكيد الطلب التجريبي
          </Button>
        </form>
      )}
    </main>
  );
}
