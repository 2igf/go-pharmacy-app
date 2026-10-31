import { useEffect, useState } from "react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Page, Feedback } from "@/components/BetaLayout";
import { ownedCustomerRecords } from "@/customer/policy";
export default function Profile() {
  const { user, logout, loading } = useAuth({
    redirectOnUnauthenticated: true,
  });
  const utils = trpc.useUtils();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [draftOwnerId, setDraftOwnerId] = useState<number | null>(null);
  useEffect(() => {
    if (user) {
      if (draftOwnerId !== user.id) setAddress("");
      setName(user.name ?? "");
      setPhone(user.phone ?? "");
      setDraftOwnerId(user.id);
    } else {
      setName("");
      setPhone("");
      setAddress("");
      setDraftOwnerId(null);
    }
  }, [user]);
  const orders = trpc.orders.list.useQuery(undefined, {
    enabled: !!user,
    refetchInterval: 10000,
  });
  const addresses = trpc.addresses.list.useQuery(undefined, {
    enabled: !!user,
  });
  const update = trpc.auth.updateProfile.useMutation({
    onSuccess: () => utils.auth.me.invalidate(),
  });
  const add = trpc.addresses.create.useMutation({
    onSuccess: () => {
      setAddress("");
      utils.addresses.invalidate();
    },
  });
  const remove = trpc.addresses.delete.useMutation({
    onSuccess: () => utils.addresses.invalidate(),
  });
  if (!user || loading)
    return (
      <Page title="حسابي وطلباتي">
        <p role="status">
          {loading ? "جار التحقق من الجلسة…" : "سجّل الدخول للوصول إلى حسابك."}
        </p>
        <Link href="/login">تسجيل الدخول</Link>
      </Page>
    );
  return (
    <Page title="حسابي وطلباتي">
      <p>
        {user?.email} — {user?.role}
      </p>
      <Feedback
        error={
          orders.error ??
          addresses.error ??
          update.error ??
          add.error ??
          remove.error
        }
        loading={orders.isLoading}
      />
      <form
        className="space-y-3 max-w-lg"
        onSubmit={e => {
          e.preventDefault();
          update.mutate({ name, phone });
        }}
      >
        <label className="block">
          الاسم الخيالي
          <Input
            required
            minLength={2}
            maxLength={100}
            value={draftOwnerId === user.id ? name : ""}
            onChange={e => setName(e.target.value)}
          />
        </label>
        <label className="block">
          رقم اختبار
          <Input
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            maxLength={40}
            value={draftOwnerId === user.id ? phone : ""}
            onChange={e => setPhone(e.target.value)}
          />
        </label>
        <Button disabled={update.isPending}>حفظ الحساب</Button>
        {update.isSuccess && <p role="status">تم حفظ الحساب</p>}
      </form>
      <h2 className="text-xl font-bold">عناوين الاختبار</h2>
      {ownedCustomerRecords(addresses.data, user.id, addresses.error).map(item => (
        <div key={item.id} className="flex gap-4 border rounded p-3">
          <p>{item.address}</p>
          <Button
            variant="outline"
            disabled={remove.isPending}
            onClick={() => {
              if (window.confirm("هل تريد حذف هذا العنوان؟")) remove.mutate({ id: item.id });
            }}
          >
            حذف العنوان
          </Button>
        </div>
      ))}
      <form
        className="space-y-3 max-w-lg"
        onSubmit={e => {
          e.preventDefault();
          add.mutate({ address, label: "اختبار" });
        }}
      >
        <label className="block">
          عنوان خيالي جديد
          <Input
            required
            minLength={5}
            maxLength={500}
            value={draftOwnerId === user.id ? address : ""}
            onChange={e => setAddress(e.target.value)}
          />
        </label>
        <Button disabled={add.isPending}>إضافة العنوان</Button>
      </form>
      <h2 className="text-xl font-bold">كل الطلبات</h2>
      {orders.data?.length === 0 && <p>لا توجد طلبات بعد</p>}
      {ownedCustomerRecords(orders.data, user.id, orders.error).map(order => (
        <Link
          className="block border rounded p-4"
          key={order.id}
          href={`/order/${order.id}`}
        >
          {order.orderNumber} — {order.totalAmount} JD — {order.status}
          {order.isSimulated ? " — محاكاة" : " — سجل سابق"}
        </Link>
      ))}
      <section className="space-y-3" aria-label="إعدادات الحساب">
        <h2 className="text-xl font-bold">إعدادات الحساب</h2>
        <p>لغة الواجهة الحالية: العربية. ترجمة الواجهة كاملة إلى الإنجليزية غير متاحة بعد؛ تتوفر لغة المصدر في دليل الأدوية.</p>
        <Link className="block underline" href="/reminders">إعدادات إشعارات منبّه الدواء</Link>
        <Link className="block underline" href="/notifications">إشعارات الحساب والطلبات</Link>
        <Link className="block underline" href="/medicines">دليل معلومات الأدوية ومصادرها</Link>
        <Link className="block underline" href="/forgot-password">استعادة كلمة المرور</Link>
      </section>
      <Button
        variant="outline"
        onClick={async () => {
          await logout();
          utils.invalidate();
          location.assign("/login");
        }}
      >
        تسجيل الخروج
      </Button>
    </Page>
  );
}
