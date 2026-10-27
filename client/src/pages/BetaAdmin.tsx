import { useState } from "react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Page, Feedback } from "@/components/BetaLayout";
const empty = {
  name: "",
  price: "",
  stock: "0",
  category: "skincare" as const,
  description: "",
  manufacturer: "",
  requiresPrescription: false,
};
type Form = Omit<typeof empty, "category"> & {
  category:
    | "medications"
    | "medical_supplies"
    | "natural_products"
    | "skincare"
    | "baby_care"
    | "pet_care";
};
export default function BetaAdmin() {
  const { user, loading } = useAuth({ redirectOnUnauthenticated: true });
  const utils = trpc.useUtils();
  const [form, setForm] = useState<Form>(empty);
  const [editId, setEditId] = useState<number | null>(null);
  const allowed = user?.role === "admin";
  const products = trpc.products.list.useQuery(
    { limit: 100, offset: 0 },
    { enabled: allowed }
  );
  const orders = trpc.admin.orders.useQuery(undefined, {
    enabled: allowed,
    refetchInterval: 10000,
  });
  const refresh = () => {
    utils.products.invalidate();
    utils.admin.invalidate();
  };
  const saved = () => {
    refresh();
    setForm(empty);
    setEditId(null);
  };
  const add = trpc.products.create.useMutation({ onSuccess: saved });
  const update = trpc.products.update.useMutation({ onSuccess: saved });
  const remove = trpc.products.delete.useMutation({ onSuccess: refresh });
  const status = trpc.admin.updateStatus.useMutation({ onSuccess: refresh });
  if (loading) return <Feedback loading />;
  if (!allowed)
    return (
      <Page title="غير مصرح">
        <p role="alert">هذه الصفحة للمسؤول فقط.</p>
      </Page>
    );
  const transitions = {
    pending: ["confirmed", "cancelled"],
    confirmed: ["processing", "cancelled"],
    processing: ["shipped", "cancelled"],
    shipped: ["delivered"],
    delivered: [],
    cancelled: [],
  } as const;
  return (
    <Page title="إدارة النسخة التجريبية">
      <Link
        href="/admin/pharmacies"
        className="inline-block text-primary underline"
      >
        إدارة طلبات الصيدليات والعضويات
      </Link>
      <Feedback
        error={
          products.error ??
          orders.error ??
          add.error ??
          update.error ??
          remove.error ??
          status.error
        }
        loading={products.isLoading || orders.isLoading}
      />
      <p>
        آخر {orders.data?.length ?? 0} طلب (حد العرض 100). جميع المبالغ المعروضة
        محاكاة وليست مبيعات.
      </p>
      <h2 className="text-xl font-bold">
        {editId ? "تعديل المنتج والمخزون" : "منتج تجريبي جديد"}
      </h2>
      <form
        className="grid gap-3 sm:grid-cols-2"
        onSubmit={e => {
          e.preventDefault();
          if (editId) update.mutate({ ...form, id: editId });
          else add.mutate(form);
        }}
      >
        <label>
          اسم المنتج
          <Input
            required
            minLength={1}
            maxLength={255}
            value={form.name}
            onChange={e => setForm({ ...form, name: e.target.value })}
          />
        </label>
        <label>
          السعر JD
          <Input
            required
            inputMode="decimal"
            pattern="[0-9]{1,8}(\.[0-9]{1,2})?"
            value={form.price}
            onChange={e => setForm({ ...form, price: e.target.value })}
          />
        </label>
        <label>
          المخزون
          <Input
            required
            type="number"
            min={0}
            max={999999}
            step={1}
            value={form.stock}
            onChange={e => setForm({ ...form, stock: e.target.value })}
          />
        </label>
        <label>
          الفئة
          <select
            className="block border p-2 w-full rounded"
            value={form.category}
            onChange={e =>
              setForm({ ...form, category: e.target.value as Form["category"] })
            }
          >
            {[
              "medications",
              "medical_supplies",
              "natural_products",
              "skincare",
              "baby_care",
              "pet_care",
            ].map(c => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
        <label>
          الوصف
          <Input
            maxLength={5000}
            value={form.description}
            onChange={e => setForm({ ...form, description: e.target.value })}
          />
        </label>
        <label>
          الشركة الخيالية
          <Input
            maxLength={255}
            value={form.manufacturer}
            onChange={e => setForm({ ...form, manufacturer: e.target.value })}
          />
        </label>
        <label>
          <input
            type="checkbox"
            checked={form.requiresPrescription}
            onChange={e =>
              setForm({ ...form, requiresPrescription: e.target.checked })
            }
          />{" "}
          يتطلب وصفة — محظور في البيتا
        </label>
        <Button disabled={add.isPending || update.isPending}>حفظ المنتج</Button>
        {editId && (
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setEditId(null);
              setForm(empty);
            }}
          >
            إلغاء التعديل
          </Button>
        )}
      </form>
      <h2 className="text-xl font-bold">المنتجات والمخزون</h2>
      {products.data?.map(p => (
        <article key={p.id} className="border p-4 rounded space-y-2">
          <p>
            {p.name}: {p.price} JD — المخزون {p.stock}
          </p>
          <div className="flex gap-3">
            <Button
              onClick={() => {
                setEditId(p.id);
                setForm({
                  name: p.name,
                  price: p.price,
                  category: p.category,
                  stock: String(p.stock),
                  description: p.description ?? "",
                  manufacturer: p.manufacturer ?? "",
                  requiresPrescription: p.requiresPrescription,
                });
                window.scrollTo(0, 0);
              }}
            >
              تعديل
            </Button>
            <Button
              variant="outline"
              disabled={remove.isPending}
              onClick={() => {
                if (window.confirm("أرشفة المنتج وإخفاؤه من المتجر؟"))
                  remove.mutate({ id: p.id });
              }}
            >
              أرشفة
            </Button>
          </div>
        </article>
      ))}
      <h2 className="text-xl font-bold">إدارة الطلبات</h2>
      {orders.data?.map(order => (
        <article key={order.id} className="border rounded p-4 space-y-2">
          <p>
            {order.orderNumber} — مستخدم #{order.userId} — {order.totalAmount}{" "}
            JD — {order.status}
          </p>
          <p>
            {order.contactName} — {order.contactPhone} — {order.deliveryAddress}
          </p>
          {order.isSimulated ? (
            <div className="flex flex-wrap gap-3">
              {transitions[order.status].map(next => (
                <Button
                  key={next}
                  disabled={status.isPending}
                  onClick={() => status.mutate({ id: order.id, status: next })}
                >
                  {next}
                </Button>
              ))}
            </div>
          ) : (
            <p>سجل سابق — الإدارة التجريبية معطلة له</p>
          )}
        </article>
      ))}
    </Page>
  );
}
