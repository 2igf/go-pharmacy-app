import { useEffect, useState } from "react";
import { Link } from "wouter";
import { ChevronLeft, MapPin, Package, UserRound } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Page, Feedback } from "@/components/BetaLayout";
import { ownedCustomerRecords } from "@/customer/policy";
import { customerOrderStatus, shortOrderNumber } from "@/customer/profile";
import "@/customer/profile.css";

export default function Profile() {
  const { user, logout, loading } = useAuth({
    redirectOnUnauthenticated: true,
  });
  const utils = trpc.useUtils();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [draftOwnerId, setDraftOwnerId] = useState<number | null>(null);
  const [editing, setEditing] = useState<{
    id: number;
    ownerId: number;
    address: string;
  } | null>(null);
  useEffect(() => {
    if (user) {
      if (draftOwnerId !== user.id) {
        setAddress("");
        setEditing(null);
      }
      setName(user.name ?? "");
      setPhone(user.phone ?? "");
      setDraftOwnerId(user.id);
    } else {
      setName("");
      setPhone("");
      setAddress("");
      setEditing(null);
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
  const edit = trpc.addresses.update.useMutation({
    onSuccess: () => {
      setEditing(null);
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
  const ownAddresses = ownedCustomerRecords(
    addresses.data,
    user.id,
    addresses.error
  );
  const ownOrders = ownedCustomerRecords(orders.data, user.id, orders.error);
  const addressBusy = add.isPending || edit.isPending || remove.isPending;
  return (
    <main className="customer-profile" dir="rtl">
      <header className="profile-header">
        <h1>ملفي الشخصي</h1>
        <div className="profile-identity">
          <span className="profile-avatar" aria-hidden="true">
            <UserRound />
          </span>
          <div>
            <p className="profile-account-kind">الحساب الشخصي</p>
            <h2 dir="auto">{user.name || "مرحباً بك"}</h2>
            <p className="profile-contact">
              <bdi>{user.email}</bdi>
            </p>
            <p className="profile-contact">
              رقم الهاتف: <bdi>{user.phone || "لم تضف رقم هاتف بعد"}</bdi>
            </p>
          </div>
        </div>
      </header>
      <div className="profile-sections">
        <Feedback
          error={
            orders.error ??
            addresses.error ??
            update.error ??
            add.error ??
            edit.error ??
            remove.error
          }
        />
        <section
          className="profile-panel"
          aria-labelledby="profile-information"
        >
          <h2 id="profile-information">معلومات الحساب</h2>
          <form
            className="profile-form"
            onSubmit={e => {
              e.preventDefault();
              update.mutate({ name, phone });
            }}
          >
            <label>
              الاسم
              <Input
                required
                minLength={2}
                maxLength={100}
                autoComplete="name"
                value={draftOwnerId === user.id ? name : ""}
                onChange={e => setName(e.target.value)}
              />
            </label>
            <label>
              رقم الهاتف
              <Input
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                maxLength={40}
                dir="auto"
                value={draftOwnerId === user.id ? phone : ""}
                onChange={e => setPhone(e.target.value)}
              />
            </label>
            <Button disabled={update.isPending}>
              {update.isPending ? "جار الحفظ…" : "حفظ الحساب"}
            </Button>
            {update.isSuccess && (
              <p className="profile-success" role="status">
                تم حفظ الحساب
              </p>
            )}
          </form>
        </section>
        <section className="profile-panel" aria-labelledby="profile-addresses">
          <h2 id="profile-addresses">
            <MapPin aria-hidden="true" /> عناويني
          </h2>
          <Feedback loading={addresses.isLoading} />
          {!addresses.isLoading &&
            !addresses.error &&
            ownAddresses.length === 0 && (
              <p className="profile-muted">
                لا توجد عناوين محفوظة. أضف عنواناً لتستخدمه في طلبات المحاكاة.
              </p>
            )}
          <div className="profile-records">
            {ownAddresses.map(item => (
              <article key={item.id} className="profile-address-card">
                {editing?.ownerId === user.id && editing.id === item.id ? (
                  <form
                    className="profile-form"
                    onSubmit={e => {
                      e.preventDefault();
                      edit.mutate({ id: item.id, address: editing.address });
                    }}
                  >
                    <label>
                      تعديل العنوان
                      <Input
                        autoFocus
                        required
                        minLength={5}
                        maxLength={500}
                        value={editing.address}
                        onChange={e =>
                          setEditing({ ...editing, address: e.target.value })
                        }
                      />
                    </label>
                    <div className="profile-actions">
                      <Button disabled={addressBusy}>
                        {edit.isPending ? "جار الحفظ…" : "حفظ العنوان"}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        disabled={addressBusy}
                        onClick={() => setEditing(null)}
                      >
                        إلغاء
                      </Button>
                    </div>
                  </form>
                ) : (
                  <>
                    <p dir="auto">{item.address}</p>
                    <div className="profile-actions">
                      <Button
                        type="button"
                        variant="outline"
                        disabled={addressBusy}
                        onClick={() => {
                          edit.reset();
                          setEditing({
                            id: item.id,
                            ownerId: user.id,
                            address: item.address,
                          });
                        }}
                      >
                        تعديل العنوان
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        disabled={addressBusy}
                        onClick={() => {
                          if (window.confirm("هل تريد حذف هذا العنوان؟"))
                            remove.mutate({ id: item.id });
                        }}
                      >
                        حذف العنوان
                      </Button>
                    </div>
                  </>
                )}
              </article>
            ))}
          </div>
          <form
            className="profile-form profile-new-address"
            onSubmit={e => {
              e.preventDefault();
              add.mutate({ address, label: "اختبار" });
            }}
          >
            <label>
              عنوان جديد
              <Input
                required
                minLength={5}
                maxLength={500}
                autoComplete="street-address"
                value={draftOwnerId === user.id ? address : ""}
                onChange={e => setAddress(e.target.value)}
              />
            </label>
            <Button disabled={addressBusy}>
              {add.isPending ? "جار الإضافة…" : "إضافة العنوان"}
            </Button>
          </form>
          {(edit.isSuccess || add.isSuccess || remove.isSuccess) && (
            <p className="profile-success" role="status">
              تم تحديث العناوين
            </p>
          )}
        </section>
        <section className="profile-panel" aria-labelledby="profile-orders">
          <h2 id="profile-orders">
            <Package aria-hidden="true" /> طلباتي
          </h2>
          <Feedback loading={orders.isLoading} />
          {!orders.isLoading && !orders.error && ownOrders.length === 0 && (
            <p className="profile-muted">
              لا توجد طلبات بعد. ستجد طلباتك المحفوظة هنا.
            </p>
          )}
          <div className="profile-records">
            {ownOrders.map(order => (
              <Link
                key={order.id}
                className="profile-order-card"
                href={`/order/${order.id}`}
              >
                <div className="profile-order-summary">
                  <strong>
                    طلب{" "}
                    <bdi title={order.orderNumber}>
                      {shortOrderNumber(order.orderNumber)}
                    </bdi>
                  </strong>
                  <span className="profile-order-status">
                    {customerOrderStatus(order.status)}
                  </span>
                </div>
                <div className="profile-order-summary">
                  <span>
                    {order.isSimulated
                      ? "طلب محاكاة — لا دفع أو توصيل"
                      : "سجل سابق"}
                  </span>
                  <strong>
                    <bdi>{order.totalAmount} د.أ</bdi>
                  </strong>
                </div>
                <span className="profile-order-detail">
                  عرض التفاصيل <ChevronLeft aria-hidden="true" />
                </span>
                {order.orderNumber.length > 20 && (
                  <small className="profile-muted">
                    الرقم الكامل في تفاصيل الطلب
                  </small>
                )}
              </Link>
            ))}
          </div>
        </section>
        <section
          className="profile-panel profile-settings"
          aria-labelledby="profile-settings"
        >
          <h2 id="profile-settings">إعدادات الحساب</h2>
          <Link href="/reminders">
            إعدادات إشعارات منبّه الدواء <ChevronLeft aria-hidden="true" />
          </Link>
          <Link href="/notifications">
            إشعارات الحساب والطلبات <ChevronLeft aria-hidden="true" />
          </Link>
          <Link href="/medicines">
            دليل معلومات الأدوية ومصادرها <ChevronLeft aria-hidden="true" />
          </Link>
          <Link href="/forgot-password">
            استعادة كلمة المرور <ChevronLeft aria-hidden="true" />
          </Link>
          <p className="profile-muted">
            لغة الواجهة الحالية: العربية. ترجمة الواجهة كاملة إلى الإنجليزية غير
            متاحة بعد؛ تتوفر لغة المصدر في دليل الأدوية.
          </p>
        </section>
        <Button
          className="profile-logout"
          variant="outline"
          onClick={async () => {
            await logout();
            utils.invalidate();
            location.assign("/login");
          }}
        >
          تسجيل الخروج
        </Button>
      </div>
    </main>
  );
}
