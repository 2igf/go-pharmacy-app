import { useState } from "react";
import { Link, useLocation, useSearch } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import Login from "@/pages/Login";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Feedback } from "@/components/BetaLayout";
import {
  PrivateQueryScope,
  Panel,
  Notice,
  liveQuery,
  useMemberships,
} from "./common";
import {
  selectPortalMembership,
  portalPermissions,
  statusLabels,
  roleLabels,
  memberStatusLabels,
  type Membership,
} from "./policy";
import Inventory from "./Inventory";
import { Members, Activity } from "./Records";

export default function PartnersPortal() {
  const { user, loading, error, logout } = useAuth();
  const [path, navigate] = useLocation();
  return (
    <div dir="rtl" className="min-h-screen bg-muted/40 text-foreground">
      <header className="border-b bg-background">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4 px-5 py-5">
          <div>
            <p className="text-primary text-xl font-bold" dir="ltr">
              GO Partners
            </p>
            <p className="text-sm text-muted-foreground">
              بوابة الصيدليات • اختبار داخلي
            </p>
          </div>
          <div className="flex gap-4 items-center text-sm">
            <Link href="/">تطبيق العميل</Link>
            {user && (
              <>
                <span>الحساب #{user.id}</span>
                <Button
                  variant="outline"
                  onClick={async () => {
                    await logout();
                    navigate("/partners/login");
                  }}
                >
                  تسجيل الخروج
                </Button>
              </>
            )}
          </div>
        </div>
      </header>
      <div className="max-w-7xl mx-auto px-4 pt-4">
        <Notice>
          بيئة اختبار داخلية. لا مبيعات أو دفع أو توصيل أو صرف أدوية. استخدم
          بيانات خيالية.
        </Notice>
      </div>
      {loading ? (
        <div className="p-6">
          <Feedback loading />
        </div>
      ) : error ? (
        <div className="p-6">
          <Feedback error={error} />
        </div>
      ) : !user ? (
        <div className="max-w-4xl mx-auto py-6">
          {path === "/partners/login" ? (
            <Login successPath="/partners/pharmacy" />
          ) : (
            <Panel title="يلزم تسجيل الدخول">
              <p>سجّل الدخول بحساب مدعو للوصول إلى بوابة الشركاء.</p>
              <Link className="text-primary underline" href="/partners/login">
                تسجيل دخول الشركاء
              </Link>
            </Panel>
          )}
        </div>
      ) : (
        <PrivateQueryScope key={`${user.id}:${user.role}`}>
          <PortalAccount userId={user.id} path={path} />
        </PrivateQueryScope>
      )}
    </div>
  );
}

function PortalAccount({ userId, path }: { userId: number; path: string }) {
  const memberships = useMemberships(userId);
  const [, navigate] = useLocation();
  const search = useSearch();
  const [busy, setBusy] = useState(false);
  const [showApplication, setShowApplication] = useState(false);
  const [applicationResult, setApplicationResult] = useState("");
  if (memberships.isLoading)
    return (
      <div className="p-6">
        <Feedback loading />
      </div>
    );
  if (memberships.error)
    return (
      <div className="p-6">
        <Feedback error={memberships.error} />
        <Link href="/partners/login">العودة إلى تسجيل الدخول</Link>
      </div>
    );
  const selected = selectPortalMembership(
    memberships.data ?? [],
    new URLSearchParams(search).get("org")
  );
  const permissions = portalPermissions(selected);
  const suffix = selected ? `?org=${selected.organizationId}` : "";
  const pages = [
    { href: "/partners/pharmacy", label: "لوحة الصيدلية", allowed: true },
    {
      href: "/partners/pharmacy/inventory",
      label: "المخزون والكتالوج",
      allowed: permissions.inventory,
    },
    {
      href: "/partners/pharmacy/members",
      label: "أعضاء الصيدلية",
      allowed: permissions.members,
    },
    {
      href: "/partners/pharmacy/activity",
      label: "سجل النشاط",
      allowed: permissions.activity,
    },
  ];
  return (
    <div className="max-w-7xl mx-auto grid md:grid-cols-[230px_1fr] gap-5 px-4 py-6">
      <aside className="space-y-4">
        <Panel title="الصيدلية الحالية">
          <label className="text-sm" htmlFor="partner-organization">
            اختر الصيدلية
          </label>
          <select
            id="partner-organization"
            className="w-full border rounded-md p-2 bg-background"
            value={selected?.organizationId ?? ""}
            disabled={busy}
            onChange={e =>
              navigate(
                `${path === "/partners/login" ? "/partners/pharmacy" : path}?org=${e.target.value}`
              )
            }
          >
            <option value="" disabled>
              اختر عضوية
            </option>
            {memberships.data?.map(m => (
              <option key={m.organizationId} value={m.organizationId}>
                {m.name} — {statusLabels[m.organizationStatus]}
              </option>
            ))}
          </select>
        </Panel>
        <nav aria-label="تنقل الشركاء" className="grid gap-2">
          {pages
            .filter(p => p.allowed)
            .map(p => (
              <Link
                key={p.href}
                href={p.href + suffix}
                aria-current={path === p.href ? "page" : undefined}
                className={`rounded-lg border px-4 py-3 ${path === p.href ? "bg-primary text-primary-foreground" : "bg-background"}`}
                onClick={e => {
                  if (busy) e.preventDefault();
                }}
              >
                {p.label}
              </Link>
            ))}
        </nav>
        <Button
          variant="outline"
          className="w-full"
          disabled={busy}
          onClick={() => setShowApplication(v => !v)}
        >
          طلب تسجيل صيدلية
        </Button>
      </aside>
      <main className="min-w-0 space-y-5">
        {applicationResult && <Notice>{applicationResult}</Notice>}
        {showApplication && (
          <Application
            onSuccess={() => {
              setShowApplication(false);
              setApplicationResult(
                "أُرسل طلب الصيدلية للمراجعة. لم تُمنح صلاحيات تشغيلية؛ يلزم الاعتماد وتفعيل العضوية بصورة منفصلة."
              );
              void memberships.refetch();
            }}
          />
        )}
        {!selected ? (
          <Panel title="لا توجد عضوية مخوّلة لهذا الاختيار">
            <p>
              لا يمكن عرض بيانات تشغيلية دون عضوية. معرّف الصيدلية في الرابط لا
              يمنح وصولًا.
            </p>
            {!memberships.data?.length && (
              <p className="text-muted-foreground">
                يمكنك تقديم طلب تسجيل صيدلية للمراجعة الإدارية.
              </p>
            )}
          </Panel>
        ) : (
          <>
            <section className="flex flex-wrap justify-between gap-3">
              <div>
                <h1 className="text-2xl font-bold">{selected.name}</h1>
                <p className="text-sm text-muted-foreground">
                  صيدلية #{selected.organizationId} • الأردن •{" "}
                  {roleLabels[selected.role]}
                </p>
              </div>
              <div className="text-sm">
                <p>
                  المؤسسة:{" "}
                  <strong>{statusLabels[selected.organizationStatus]}</strong>
                </p>
                <p>العضوية: {memberStatusLabels[selected.membershipStatus]}</p>
              </div>
            </section>
            {!permissions.inventory ? (
              <Notice error>
                الوصول التشغيلي غير متاح. يلزم اعتماد المؤسسة وتفعيل العضوية؛
                اعتماد المؤسسة وحده لا يفعّل العضوية.
              </Notice>
            ) : (
              <PrivateQueryScope
                key={`${userId}:${selected.organizationId}:${selected.role}:${selected.membershipStatus}:${selected.organizationStatus}`}
              >
                <OrganizationPage
                  userId={userId}
                  member={selected}
                  path={path}
                  onBusy={setBusy}
                />
              </PrivateQueryScope>
            )}
          </>
        )}
      </main>
    </div>
  );
}

function OrganizationPage({
  userId,
  member,
  path,
  onBusy,
}: {
  userId: number;
  member: Membership;
  path: string;
  onBusy(value: boolean): void;
}) {
  const permission = portalPermissions(member);
  if (path === "/partners/pharmacy/inventory")
    return <Inventory userId={userId} member={member} onBusy={onBusy} />;
  if (path === "/partners/pharmacy/members")
    return permission.members ? (
      <Members organizationId={member.organizationId} />
    ) : (
      <Notice error>عرض الأعضاء للمالك أو المدير المخوّل فقط.</Notice>
    );
  if (path === "/partners/pharmacy/activity")
    return permission.activity ? (
      <Activity organizationId={member.organizationId} />
    ) : (
      <Notice error>سجل النشاط للمالك أو المدير المخوّل فقط.</Notice>
    );
  if (!["/partners", "/partners/login", "/partners/pharmacy"].includes(path))
    return <Notice error>هذه الصفحة غير موجودة في بوابة الصيدلية.</Notice>;
  return <Dashboard organizationId={member.organizationId} />;
}
function Dashboard({ organizationId }: { organizationId: number }) {
  const inventory = trpc.pharmacies.inventory.list.useQuery(
    { organizationId, limit: 5 },
    liveQuery
  );
  return (
    <Panel title="لمحة من مخزون الصيدلية">
      <p className="text-muted-foreground">
        أول خمسة منتجات مسجلة من المخزون الفعلي لهذه الصيدلية. لا توجد مؤشرات
        مبيعات أو طلبات في هذه المرحلة.
      </p>
      {inventory.isLoading ? (
        <Feedback loading />
      ) : inventory.error ? (
        <Feedback error={inventory.error} />
      ) : !inventory.data?.length ? (
        <Notice>
          لا توجد أرصدة مسجلة بعد. افتح المخزون واختر منتجًا من الكتالوج.
        </Notice>
      ) : (
        <ul className="divide-y">
          {inventory.data.map(item => (
            <li
              key={item.productId}
              className="py-3 flex justify-between gap-4"
            >
              <span>{item.productName}</span>
              <strong>{item.quantity} وحدة</strong>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
function Application({ onSuccess }: { onSuccess(): void }) {
  const [name, setName] = useState("");
  const [registrationNumber, setRegistrationNumber] = useState("");
  const application = trpc.pharmacies.submitApplication.useMutation({
    onSuccess,
  });
  return (
    <Panel title="طلب تسجيل صيدلية">
      <p className="text-sm">
        الطلب لا يمنح صلاحيات تشغيلية. التحقق من المرجع والاعتماد وتفعيل العضوية
        إجراءات إدارية منفصلة.
      </p>
      <form
        className="grid gap-3 sm:grid-cols-2"
        onSubmit={e => {
          e.preventDefault();
          application.mutate({ name, registrationNumber, countryCode: "JO" });
        }}
      >
        <label>
          اسم الصيدلية
          <Input
            required
            minLength={3}
            maxLength={200}
            value={name}
            onChange={e => setName(e.target.value)}
          />
        </label>
        <label>
          مرجع التسجيل الخيالي
          <Input
            required
            minLength={3}
            maxLength={100}
            pattern="[A-Za-z0-9/-]+"
            dir="ltr"
            value={registrationNumber}
            onChange={e => setRegistrationNumber(e.target.value)}
          />
        </label>
        <Feedback error={application.error} />
        <Button disabled={application.isPending}>إرسال للمراجعة</Button>
      </form>
    </Panel>
  );
}
