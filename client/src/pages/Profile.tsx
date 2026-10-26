import { useEffect, useState } from "react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Page, Feedback } from "@/components/BetaLayout";
export default function Profile() {
  const { user, logout } = useAuth({ redirectOnUnauthenticated: true });
  const utils = trpc.useUtils();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  useEffect(() => {
    if (user) {
      setName(user.name ?? "");
      setPhone(user.phone ?? "");
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
            value={name}
            onChange={e => setName(e.target.value)}
          />
        </label>
        <label className="block">
          رقم اختبار
          <Input
            pattern="[+0-9 ()-]{0,20}"
            maxLength={20}
            value={phone}
            onChange={e => setPhone(e.target.value)}
          />
        </label>
        <Button disabled={update.isPending}>حفظ الحساب</Button>
        {update.isSuccess && <p role="status">تم حفظ الحساب</p>}
      </form>
      <h2 className="text-xl font-bold">عناوين الاختبار</h2>
      {addresses.data?.map(item => (
        <div key={item.id} className="flex gap-4 border rounded p-3">
          <p>{item.address}</p>
          <Button
            variant="outline"
            disabled={remove.isPending}
            onClick={() => remove.mutate({ id: item.id })}
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
            value={address}
            onChange={e => setAddress(e.target.value)}
          />
        </label>
        <Button disabled={add.isPending}>إضافة العنوان</Button>
      </form>
      <h2 className="text-xl font-bold">كل الطلبات</h2>
      {orders.data?.length === 0 && <p>لا توجد طلبات بعد</p>}
      {orders.data?.map(order => (
        <Link
          className="block border rounded p-4"
          key={order.id}
          href={`/order/${order.id}`}
        >
          {order.orderNumber} — {order.totalAmount} JD — {order.status}
          {order.isSimulated ? " — محاكاة" : " — سجل سابق"}
        </Link>
      ))}
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
