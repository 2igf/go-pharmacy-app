import { useState } from "react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import Login from "@/pages/Login";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Page, Feedback } from "@/components/BetaLayout";
import { organizationTransitions } from "@shared/pharmacy-policy";
import {
  PrivateQueryScope,
  Panel,
  Notice,
  ConfirmAction,
  Pager,
  liveQuery,
  useCursor,
  useMemberships,
} from "./common";
import {
  statusLabels,
  roleLabels,
  memberStatusLabels,
  portalPermissions,
  privateQueryData,
  type Membership,
  type Outputs,
} from "./policy";
import { Members } from "./Records";
type Organization = Outputs["pharmacies"]["administration"]["list"][number];
type Status = Organization["status"];
type Draft = {
  userId: string;
  role: keyof typeof roleLabels;
  status: keyof typeof memberStatusLabels;
  reason: string;
};

export default function AdminPharmacies() {
  const { user, loading, error } = useAuth();
  if (loading) return <Feedback loading />;
  if (error) return <Feedback error={error} />;
  if (!user) return <Login successPath="/admin/pharmacies" />;
  if (user.role !== "admin")
    return (
      <Page title="غير مصرح">
        <Notice error>
          إدارة الصيدليات للمسؤول فقط. دور الصيدلي أو معرّف في الرابط لا يمنح
          صلاحية إدارية.
        </Notice>
      </Page>
    );
  return (
    <PrivateQueryScope key={`${user.id}:${user.role}`}>
      <Administration userId={user.id} />
    </PrivateQueryScope>
  );
}
function Administration({ userId }: { userId: number }) {
  const [filter, setFilter] = useState<Status | "">("");
  const [selectedId, setSelectedId] = useState<number>();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const cursor = useCursor();
  const memberships = useMemberships(userId);
  const query = trpc.pharmacies.administration.list.useQuery(
    { status: filter || undefined, afterId: cursor.value, limit: 50 },
    liveQuery
  );
  const selected = query.data?.find(org => org.id === selectedId);
  return (
    <Page title="إدارة الصيدليات">
      <div className="flex gap-4 text-sm">
        <Link className="text-primary underline" href="/admin">
          إدارة المنتجات والطلبات
        </Link>
        <Link className="text-primary underline" href="/partners/pharmacy">
          بوابة الصيدلية
        </Link>
      </div>
      <Notice>
        طلبات خيالية للاختبار الداخلي. اعتماد المؤسسة لا يفعّل العضوية؛ عرض
        الأعضاء يتطلب عضوية مخوّلة منفصلة.
      </Notice>
      {message && <Notice>{message}</Notice>}
      {memberships.error && (
        <Notice error>
          تعذر التحقق من صلاحية عرض الأعضاء؛ حُجبت بيانات العضويات التشغيلية.
        </Notice>
      )}
      <Panel title="طلبات الصيدليات">
        <label>
          حالة الطلب
          <select
            className="border p-2 rounded ms-3 bg-background"
            value={filter}
            disabled={busy}
            onChange={e => {
              setFilter(e.target.value as Status | "");
              cursor.reset();
              setSelectedId(undefined);
            }}
          >
            <option value="">جميع الحالات</option>
            {Object.entries(statusLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        {query.isLoading ? (
          <Feedback loading />
        ) : query.error ? (
          <Feedback error={query.error} />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-right">
                <thead>
                  <tr>
                    <th className="p-3">الصيدلية</th>
                    <th>مرجع التسجيل</th>
                    <th>الحالة</th>
                    <th>التفاصيل</th>
                  </tr>
                </thead>
                <tbody>
                  {query.data?.map(org => (
                    <tr key={org.id} className="border-t">
                      <td className="p-3">
                        {org.name}
                        <span className="block text-xs">#{org.id}</span>
                      </td>
                      <td dir="ltr" className="text-right">
                        {org.registrationNumber}
                      </td>
                      <td>{statusLabels[org.status]}</td>
                      <td>
                        <Button
                          variant="outline"
                          disabled={busy}
                          onClick={() => {
                            setSelectedId(org.id);
                            setMessage("");
                          }}
                        >
                          فحص الطلب
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!query.data?.length && (
              <Notice>لا توجد طلبات بهذه الحالة في الصفحة.</Notice>
            )}
            <Pager
              disabled={busy}
              count={query.data?.length ?? 0}
              limit={50}
              canPrevious={cursor.canPrevious}
              onPrevious={() => {
                cursor.previous();
                setSelectedId(undefined);
              }}
              onNext={() => {
                cursor.next(query.data!.at(-1)!.id);
                setSelectedId(undefined);
              }}
            />
          </>
        )}
      </Panel>
      {!query.error && selected && (
        <PrivateQueryScope key={`${userId}:${selected.id}:${selected.status}`}>
          <ApplicationDetail
            userId={userId}
            org={selected}
            ownMembership={privateQueryData(memberships)?.find(
              m => m.organizationId === selected.id
            )}
            onBusy={setBusy}
            onSaved={text => {
              setMessage(text);
              void query.refetch();
              void memberships.refetch();
            }}
          />
        </PrivateQueryScope>
      )}
    </Page>
  );
}
function ApplicationDetail({
  userId,
  org,
  ownMembership,
  onBusy,
  onSaved,
}: {
  userId: number;
  org: Organization;
  ownMembership?: Membership;
  onBusy(value: boolean): void;
  onSaved(text: string): void;
}) {
  const allowedTransitions: readonly Status[] =
    organizationTransitions[org.status];
  const transitions = allowedTransitions.filter(
    status => !(status === "approved" && org.createdBy === userId)
  );
  const [nextStatus, setNextStatus] = useState<Status>(
    transitions[0] ?? org.status
  );
  const [reviewReason, setReviewReason] = useState("");
  const [draft, setDraft] = useState<Draft>({
    userId: String(org.createdBy),
    role: "owner",
    status: org.status === "approved" ? "active" : "pending",
    reason: "",
  });
  const [confirmation, setConfirmation] = useState<"review" | "membership">();
  const utils = trpc.useUtils();
  const review = trpc.pharmacies.administration.review.useMutation({
    onSuccess: () =>
      onSaved(`حُدّثت حالة ${org.name}. تفعيل العضوية إجراء مستقل.`),
  });
  const membership = trpc.pharmacies.administration.setMembership.useMutation({
    onSuccess: () => {
      onSaved(`حُفظت عضوية الحساب #${draft.userId} في ${org.name}.`);
      void utils.pharmacies.members.invalidate();
      setDraft(d => ({ ...d, reason: "" }));
    },
  });
  const busy = review.isPending || membership.isPending;
  const run = (operation: "review" | "membership") => {
    setConfirmation(undefined);
    onBusy(true);
    const action =
      operation === "review"
        ? review.mutateAsync({
            organizationId: org.id,
            status: nextStatus,
            reason: reviewReason,
          })
        : membership.mutateAsync({
            organizationId: org.id,
            userId: Number(draft.userId),
            role: draft.role,
            status: draft.status,
            reason: draft.reason,
          });
    void action.catch(() => {}).finally(() => onBusy(false));
  };
  return (
    <>
      <Panel title={`تفاصيل: ${org.name}`}>
        <dl className="grid gap-3 sm:grid-cols-2 text-sm">
          <div>
            <dt className="text-muted-foreground">المؤسسة</dt>
            <dd>
              #{org.id} • صيدلية • {org.countryCode}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">مرجع التسجيل</dt>
            <dd dir="ltr" className="text-right">
              {org.registrationNumber}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">صاحب الطلب</dt>
            <dd>الحساب #{org.createdBy}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">الحالة</dt>
            <dd>{statusLabels[org.status]}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">تاريخ التقديم</dt>
            <dd>{new Date(org.createdAt).toLocaleString("ar-JO")}</dd>
          </div>
        </dl>
        <p className="text-sm">
          تحقق إداريًا من المرجع قبل الاعتماد. هذه الواجهة لا تتحقق من التراخيص
          الحكومية تلقائيًا.
        </p>
        <Feedback error={review.error} loading={review.isPending} />
        {org.createdBy === userId && (
          <Notice error>
            لا يمكنك اعتماد طلبك بنفسك. الخادم يفرض هذا القيد أيضًا.
          </Notice>
        )}
        {transitions.length > 0 && (
          <form
            className="grid gap-3 sm:grid-cols-2"
            onSubmit={e => {
              e.preventDefault();
              setConfirmation("review");
            }}
          >
            <label>
              الحالة التالية
              <select
                className="block border p-2 rounded w-full bg-background"
                value={nextStatus}
                disabled={busy}
                onChange={e => setNextStatus(e.target.value as Status)}
              >
                {transitions.map(status => (
                  <option key={status} value={status}>
                    {statusLabels[status]}
                  </option>
                ))}
              </select>
            </label>
            <label>
              سبب المراجعة
              <Input
                required
                minLength={3}
                maxLength={500}
                value={reviewReason}
                onChange={e => setReviewReason(e.target.value)}
                disabled={busy}
              />
            </label>
            <Button disabled={busy}>مراجعة تغيير الحالة</Button>
          </form>
        )}
      </Panel>
      <Panel title="تعيين وإدارة العضويات">
        <p className="text-sm">
          أدخل معرّف حساب موجود. لا يتغير الدور العام للحساب. ملكية الصيدلية
          لصاحب الطلب ولا يمكن نقلها هنا.
        </p>
        <Feedback error={membership.error} loading={membership.isPending} />
        <form
          className="grid gap-3 sm:grid-cols-2"
          onSubmit={e => {
            e.preventDefault();
            setConfirmation("membership");
          }}
        >
          <label>
            معرّف حساب الموظف
            <Input
              type="number"
              required
              min={1}
              max={2147483647}
              step={1}
              value={draft.userId}
              disabled={busy}
              onChange={e =>
                setDraft(d => ({
                  ...d,
                  userId: e.target.value,
                  role:
                    Number(e.target.value) === org.createdBy
                      ? "owner"
                      : "inventory_staff",
                }))
              }
            />
          </label>
          <label>
            دور العضوية
            <select
              className="block border p-2 rounded w-full bg-background"
              value={draft.role}
              disabled={busy || Number(draft.userId) === org.createdBy}
              onChange={e =>
                setDraft(d => ({ ...d, role: e.target.value as Draft["role"] }))
              }
            >
              {Object.entries(roleLabels)
                .filter(
                  ([role]) =>
                    role !== "owner" || Number(draft.userId) === org.createdBy
                )
                .map(([role, label]) => (
                  <option key={role} value={role}>
                    {label}
                  </option>
                ))}
            </select>
          </label>
          <label>
            حالة العضوية
            <select
              className="block border p-2 rounded w-full bg-background"
              value={draft.status}
              disabled={busy}
              onChange={e =>
                setDraft(d => ({
                  ...d,
                  status: e.target.value as Draft["status"],
                }))
              }
            >
              {Object.entries(memberStatusLabels).map(([status, label]) => (
                <option
                  key={status}
                  value={status}
                  disabled={status === "active" && org.status !== "approved"}
                >
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label>
            سبب تغيير العضوية
            <Input
              required
              minLength={3}
              maxLength={500}
              value={draft.reason}
              disabled={busy}
              onChange={e => setDraft(d => ({ ...d, reason: e.target.value }))}
            />
          </label>
          <Button disabled={busy}>مراجعة حفظ العضوية</Button>
        </form>
      </Panel>
      {portalPermissions(ownMembership).members ? (
        <Members
          organizationId={org.id}
          onEdit={
            busy
              ? undefined
              : member =>
                  setDraft({
                    userId: String(member.userId),
                    role: member.role,
                    status: member.status,
                    reason: "",
                  })
          }
        />
      ) : (
        <Notice>
          قائمة الأعضاء غير مخوّلة لهذا الحساب في هذه الصيدلية. الإدارة لا تحصل
          تلقائيًا على عضوية؛ لا تُعرض أي بيانات أعضاء دون صلاحية المالك أو
          المدير النشطة.
        </Notice>
      )}
      <ConfirmAction
        open={!!confirmation}
        title={
          confirmation === "review"
            ? "تأكيد مراجعة الصيدلية"
            : "تأكيد تغيير العضوية"
        }
        onCancel={() => setConfirmation(undefined)}
        onConfirm={() => {
          if (confirmation) run(confirmation);
        }}
      >
        <p>
          {org.name} • #{org.id}
        </p>
        {confirmation === "review" ? (
          <>
            <p>
              {statusLabels[org.status]} إلى {statusLabels[nextStatus]}
            </p>
            <p>{reviewReason}</p>
          </>
        ) : (
          <>
            <p>
              الحساب #{draft.userId} • {roleLabels[draft.role]} •{" "}
              {memberStatusLabels[draft.status]}
            </p>
            <p>{draft.reason}</p>
          </>
        )}
      </ConfirmAction>
    </>
  );
}
