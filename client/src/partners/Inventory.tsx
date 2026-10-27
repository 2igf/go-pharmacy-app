import { useEffect, useState } from "react";
import { z } from "zod";
import { trpc } from "@/lib/trpc";
import { getNativeApiOrigin } from "@/lib/api-fetch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Feedback } from "@/components/BetaLayout";
import { stockAdjustmentSchema } from "@shared/pharmacy-policy";
import {
  Panel,
  Notice,
  Pager,
  ConfirmAction,
  liveQuery,
  useCursor,
} from "./common";
import {
  portalPermissions,
  stockRequestKey,
  readPendingStock,
  isDefinitiveStockError,
  canConfirmStockReview,
  type Membership,
  type Outputs,
} from "./policy";
type Request = z.infer<typeof stockAdjustmentSchema>;
type Product = { id: number; name: string };
type Category = Outputs["products"]["list"][number]["category"];
const categories: Record<Category, string> = {
  medications: "الأدوية",
  medical_supplies: "المستلزمات الطبية",
  natural_products: "المنتجات الطبيعية",
  skincare: "العناية بالبشرة",
  baby_care: "العناية بالطفل",
  pet_care: "العناية بالحيوان",
};

export default function Inventory({
  userId,
  member,
  onBusy,
}: {
  userId: number;
  member: Membership;
  onBusy(value: boolean): void;
}) {
  const organizationId = member.organizationId;
  const storageKey = stockRequestKey(
    getNativeApiOrigin() ?? window.location.origin,
    userId,
    organizationId
  );
  const [pending, setPending] = useState<Request | undefined>(() => {
    try {
      return readPendingStock(
        sessionStorage.getItem(storageKey),
        organizationId
      );
    } catch {
      return undefined;
    }
  });
  const [selected, setSelected] = useState<Product | undefined>(() =>
    pending
      ? { id: pending.productId, name: `المنتج #${pending.productId}` }
      : undefined
  );
  const [delta, setDelta] = useState("");
  const [reason, setReason] = useState("");
  const [prepared, setPrepared] = useState<Request>();
  const [message, setMessage] = useState("");
  const [localError, setLocalError] = useState("");
  const [stockFilter, setStockFilter] = useState("all");
  const cursor = useCursor();
  const utils = trpc.useUtils();
  const inventory = trpc.pharmacies.inventory.list.useQuery(
    { organizationId, afterProductId: cursor.value, limit: 50 },
    liveQuery
  );
  const detail = trpc.pharmacies.inventory.list.useQuery(
    {
      organizationId,
      afterProductId: selected ? selected.id - 1 : 0,
      limit: 1,
    },
    { ...liveQuery, enabled: !!selected }
  );
  const current =
    detail.data?.[0]?.productId === selected?.id ? detail.data?.[0] : undefined;
  const clearPending = () => {
    try {
      sessionStorage.removeItem(storageKey);
    } catch {
      /* Clearing a completed request does not resubmit it. */
    }
    setPending(undefined);
  };
  const adjustment = trpc.pharmacies.inventory.adjust.useMutation({
    onSuccess: result => {
      clearPending();
      setMessage(
        `حُفظ الرصيد: ${result.quantity} وحدة، الإصدار ${result.version}. سُجل التعديل في سجل التدقيق.`
      );
      setDelta("");
      setReason("");
      void utils.pharmacies.inventory.invalidate();
    },
    onError: error => {
      if (isDefinitiveStockError(error)) clearPending();
      if (error.data?.code === "CONFLICT")
        setLocalError(
          "تغيّر الرصيد أو تعارض معرّف الطلب. حدّث البيانات وراجع التعديل؛ لم تتم إعادة إرساله تلقائيًا."
        );
      void utils.pharmacies.inventory.invalidate();
    },
  });
  useEffect(() => {
    onBusy(adjustment.isPending);
    return () => onBusy(false);
  }, [adjustment.isPending, onBusy]);
  const send = (request: Request) => {
    setMessage("");
    setLocalError("");
    try {
      sessionStorage.setItem(storageKey, JSON.stringify(request));
    } catch {
      setLocalError(
        "تعذر حفظ مرجع الطلب في الجلسة. لم يُرسل التعديل؛ تحقق من مساحة تخزين المتصفح."
      );
      return;
    }
    setPending(request);
    adjustment.mutate(request);
  };
  const canAdjust = portalPermissions(member).adjust;
  const visibleInventory =
    inventory.data?.filter(
      row =>
        stockFilter === "all" ||
        (stockFilter === "zero" ? row.quantity === 0 : row.quantity > 0)
    ) ?? [];
  if (
    ["FORBIDDEN", "UNAUTHORIZED"].includes(adjustment.error?.data?.code ?? "")
  )
    return (
      <Notice error>
        رفض الخادم العملية: لم تعد صلاحيتك التشغيلية متاحة. أعد التحقق من
        العضوية.
      </Notice>
    );
  if (inventory.error) return <Feedback error={inventory.error} />;
  return (
    <>
      <Panel title="المخزون المسجّل للصيدلية">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            كميات الصيدلية فقط؛ لا تغيّر مخزون أو أسعار كتالوج العميل.
          </p>
          <label className="text-sm">
            حالة مخزون الصفحة
            <select
              className="border rounded-md p-2 ms-2 bg-background"
              value={stockFilter}
              onChange={e => setStockFilter(e.target.value)}
            >
              <option value="all">الكل</option>
              <option value="positive">متوفر</option>
              <option value="zero">رصيد صفر</option>
            </select>
          </label>
        </div>
        {inventory.isLoading ? (
          <Feedback loading />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-right">
                <thead>
                  <tr>
                    <th className="p-3">المنتج</th>
                    <th>رصيد الصيدلية</th>
                    <th>الإصدار</th>
                    <th>الإجراء</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleInventory.map(row => (
                    <tr key={row.productId} className="border-t">
                      <td className="p-3">
                        {row.productName}
                        <span className="block text-xs text-muted-foreground">
                          #{row.productId}
                          {row.requiresPrescription
                            ? " • يتطلب وصفة؛ لا صرف عبر هذه البوابة"
                            : ""}
                        </span>
                      </td>
                      <td>{row.quantity}</td>
                      <td>{row.version}</td>
                      <td>
                        <Button
                          variant="outline"
                          disabled={!!pending || adjustment.isPending}
                          onClick={() => {
                            setSelected({
                              id: row.productId,
                              name: row.productName,
                            });
                            setLocalError("");
                            adjustment.reset();
                          }}
                        >
                          {canAdjust ? "مراجعة وتعديل" : "عرض الرصيد"}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!inventory.data?.length && (
              <Notice>
                لا توجد أرصدة مسجلة في هذه الصفحة. اختر منتجًا من الكتالوج
                أدناه.
              </Notice>
            )}
            {!!inventory.data?.length && !visibleInventory.length && (
              <Notice>لا توجد أرصدة تطابق الفلتر في هذه الصفحة.</Notice>
            )}
            <Pager
              count={inventory.data?.length ?? 0}
              limit={50}
              canPrevious={cursor.canPrevious}
              onPrevious={cursor.previous}
              onNext={() => cursor.next(inventory.data!.at(-1)!.productId)}
            />
          </>
        )}
      </Panel>
      <Catalog
        disabled={!!pending || adjustment.isPending}
        onSelect={product => {
          setSelected(product);
          setLocalError("");
          adjustment.reset();
        }}
      />
      {selected && (
        <Panel title={`رصيد: ${selected.name}`}>
          {detail.isLoading ? (
            <Feedback loading />
          ) : detail.error ? (
            <Feedback error={detail.error} />
          ) : (
            <>
              <p>
                الرصيد الحالي: <strong>{current?.quantity ?? 0}</strong> وحدة •
                الإصدار {current?.version ?? 0}
              </p>
              <p className="text-sm text-muted-foreground">
                عدم وجود سجل لهذا المنتج يعني رصيدًا مسجلًا صفرًا؛ لا يؤخذ
                الرصيد من المخزون العام.
              </p>
              {message && <Notice>{message}</Notice>}
              {localError && <Notice error>{localError}</Notice>}
              <Feedback error={adjustment.error} />
              {!canAdjust ? (
                <Notice>صلاحيتك للعرض فقط. تعديل المخزون غير متاح.</Notice>
              ) : pending ? (
                <Notice>
                  <p>
                    يوجد طلب محفوظ لهذا المنتج. إذا انقطع الاتصال، أعد إرسال
                    الطلب نفسه للتحقق من نتيجته دون تكرار التعديل.
                  </p>
                  <p>
                    الفرق: {pending.delta} • السبب: {pending.reason}
                  </p>
                  <Button
                    className="mt-3"
                    disabled={adjustment.isPending}
                    onClick={() => send(pending)}
                  >
                    {adjustment.isPending
                      ? "جار التحقق…"
                      : "إعادة المحاولة بالطلب نفسه"}
                  </Button>
                </Notice>
              ) : (
                <form
                  className="grid gap-4 sm:grid-cols-2"
                  onSubmit={e => {
                    e.preventDefault();
                    const parsed = stockAdjustmentSchema.safeParse({
                      organizationId,
                      productId: selected.id,
                      delta: Number(delta),
                      expectedVersion: current?.version ?? 0,
                      requestId: crypto.randomUUID(),
                      reason,
                    });
                    if (!parsed.success) {
                      setLocalError(
                        "أدخل فرق كمية صحيحًا غير صفري بين ‎-100000 و100000 وسببًا من 3 إلى500 حرف."
                      );
                      return;
                    }
                    setPrepared(parsed.data);
                  }}
                >
                  <label>
                    فرق الكمية (+ إضافة / − خصم)
                    <Input
                      type="number"
                      required
                      step={1}
                      min={-100000}
                      max={100000}
                      value={delta}
                      onChange={e => setDelta(e.target.value)}
                      disabled={adjustment.isPending}
                    />
                  </label>
                  <label>
                    سبب التعديل
                    <Input
                      required
                      minLength={3}
                      maxLength={500}
                      value={reason}
                      onChange={e => setReason(e.target.value)}
                      disabled={adjustment.isPending}
                    />
                  </label>
                  <Button type="submit" disabled={adjustment.isPending}>
                    مراجعة تعديل المخزون
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      adjustment.reset();
                      setLocalError("");
                      void detail.refetch();
                      void inventory.refetch();
                    }}
                  >
                    تحديث الرصيد
                  </Button>
                </form>
              )}
            </>
          )}
        </Panel>
      )}
      <ConfirmAction
        open={!!prepared && !detail.error && !inventory.error}
        title="تأكيد تعديل مخزون الصيدلية"
        onCancel={() => setPrepared(undefined)}
        onConfirm={() => {
          if (
            prepared &&
            !canConfirmStockReview(
              prepared.expectedVersion,
              current?.version ?? 0,
              !!detail.error || !!inventory.error,
              detail.isFetching
            )
          )
            setLocalError(
              "تغيّر الرصيد أثناء المراجعة. راجع القيم الحالية قبل تأكيد طلب جديد."
            );
          else if (prepared) send(prepared);
          setPrepared(undefined);
        }}
      >
        <p>
          {member.name} • {selected?.name}
        </p>
        <p>
          الفرق: {prepared?.delta} • الرصيد بعد التعديل:{" "}
          {(current?.quantity ?? 0) + (prepared?.delta ?? 0)}
        </p>
        <p>السبب: {prepared?.reason}</p>
        <p>هذه عملية مخزون مُدققة، وليست بيعًا أو صرفًا.</p>
      </ConfirmAction>
    </>
  );
}

function Catalog({
  disabled,
  onSelect,
}: {
  disabled: boolean;
  onSelect(product: Product): void;
}) {
  const [draft, setDraft] = useState("");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<Category | "">("");
  const [page, setPage] = useState(0);
  const all = trpc.products.list.useQuery(
    { limit: 20, offset: page * 20 },
    { enabled: !query && !category }
  );
  const byCategory = trpc.products.byCategory.useQuery(
    { category: category || "skincare", limit: 20, offset: page * 20 },
    { enabled: !query && !!category }
  );
  const search = trpc.products.search.useQuery(
    { query: query || "_", limit: 100 },
    { enabled: !!query }
  );
  const active = query ? search : category ? byCategory : all;
  const filteredSearch = search.data?.filter(
    product => !category || product.category === category
  );
  const products = query
    ? filteredSearch?.slice(page * 20, (page + 1) * 20)
    : active.data;
  return (
    <Panel title="الكتالوج المركزي">
      <p className="text-sm text-muted-foreground">
        ابحث عن منتج للوصول إلى رصيده أو تسجيل أول تعديل. لا تُعرض كمية المخزون
        العام كرصيد للصيدلية.
      </p>
      <form
        className="flex flex-wrap gap-3"
        onSubmit={e => {
          e.preventDefault();
          setQuery(draft.trim());
          setPage(0);
        }}
      >
        <Input
          className="flex-1 min-w-40"
          aria-label="البحث في الكتالوج"
          value={draft}
          maxLength={100}
          onChange={e => setDraft(e.target.value)}
          placeholder="اسم المنتج"
        />
        <Button type="submit">بحث الكتالوج</Button>
        <label className="sr-only" htmlFor="partner-category">
          فئة الكتالوج
        </label>
        <select
          id="partner-category"
          className="border rounded-md p-2 bg-background"
          value={category}
          onChange={e => {
            setCategory(e.target.value as Category | "");
            setPage(0);
          }}
        >
          <option value="">جميع الفئات</option>
          {Object.entries(categories).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </form>
      {query && (
        <p className="text-sm">
          البحث يعرض حتى100 نتيجة؛ ضيّق العبارة عند الحاجة.
        </p>
      )}
      {active.isLoading ? (
        <Feedback loading />
      ) : active.error ? (
        <Feedback error={active.error} />
      ) : (
        <>
          <div className="grid sm:grid-cols-2 gap-3">
            {products?.map(product => (
              <div
                key={product.id}
                className="border rounded-lg p-3 flex justify-between items-center gap-3"
              >
                <div>
                  <strong>{product.name}</strong>
                  <p className="text-xs text-muted-foreground">
                    #{product.id} • {categories[product.category]}
                  </p>
                </div>
                <Button
                  variant="outline"
                  disabled={disabled}
                  onClick={() =>
                    onSelect({ id: product.id, name: product.name })
                  }
                >
                  عرض رصيد الصيدلية
                </Button>
              </div>
            ))}
          </div>
          {!products?.length && <Notice>لا توجد نتائج في هذه الصفحة.</Notice>}
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              disabled={!page}
              onClick={() => setPage(p => p - 1)}
            >
              صفحة كتالوج سابقة
            </Button>
            <span>{page + 1}</span>
            <Button
              variant="outline"
              disabled={
                query
                  ? (page + 1) * 20 >= (filteredSearch?.length ?? 0)
                  : (products?.length ?? 0) < 20
              }
              onClick={() => setPage(p => p + 1)}
            >
              صفحة كتالوج تالية
            </Button>
          </div>
        </>
      )}
    </Panel>
  );
}
