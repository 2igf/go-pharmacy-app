import { useState } from "react";
import type { z } from "zod";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import Login from "@/pages/Login";
import { Page, Feedback } from "@/components/BetaLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  fulfillmentLabels,
  fulfillmentRequest,
  fulfillmentAssignSchema,
} from "@shared/fulfillment";
import {
  PrivateQueryScope,
  Panel,
  Notice,
  Pager,
  useCursor,
  liveQuery,
} from "./common";
import { FulfillmentRequest } from "./FulfillmentRequest";
import type { Outputs } from "./policy";
type Enrollment = z.infer<typeof fulfillmentRequest>;
type Assignment = z.infer<typeof fulfillmentAssignSchema>;
type Managed = Outputs["fulfillment"]["administration"]["list"][number];
export default function AdminFulfillment() {
  const { user, loading, error } = useAuth();
  if (loading) return <Feedback loading />;
  if (error) return <Feedback error={error} />;
  if (!user) return <Login successPath="/admin/fulfillment" />;
  if (user.role !== "admin")
    return (
      <Page title="غير مصرح">
        <Notice error>إسناد الطلبات للمسؤول المخوّل فقط.</Notice>
      </Page>
    );
  return (
    <PrivateQueryScope key={`${user.id}:${user.role}`}>
      <Configuration />
    </PrivateQueryScope>
  );
}
function Configuration() {
  const config = trpc.fulfillment.configuration.useQuery(undefined, liveQuery);
  if (config.isLoading) return <Feedback loading />;
  if (config.error) return <Feedback error={config.error} />;
  return config.data?.enabled ? (
    <Administration />
  ) : (
    <Page title="تنفيذ الطلبات التجريبية">
      <Notice>
        الميزة غير مفعّلة على هذا الخادم. يلزم تطبيق الهجرة والمراجعة التشغيلية
        قبل تفعيلها.
      </Notice>
    </Page>
  );
}
function Administration() {
  const cursor = useCursor();
  const [selected, setSelected] = useState<number>();
  const [busy, setBusy] = useState(false);
  const list = trpc.fulfillment.administration.list.useQuery(
    { afterOrderId: cursor.value, limit: 25 },
    liveQuery
  );
  const current = list.error
    ? undefined
    : list.data?.find(x => x.orderId === selected);
  return (
    <Page title="إسناد وتنفيذ الطلبات التجريبية">
      <Notice>
        اختبار داخلي بمنتجات DEMO غير دوائية فقط. الإدراج والإسناد صريحان؛ لا
        تُسند الطلبات التاريخية تلقائيًا.
      </Notice>
      <EnrollmentPanel onBusy={setBusy} />
      <Panel title="الطلبات المدرجة في مسار التنفيذ">
        {list.isLoading ? (
          <Feedback loading />
        ) : list.error ? (
          <Feedback error={list.error} />
        ) : (
          <>
            {!list.data?.length ? (
              <Notice>لا توجد طلبات مدرجة في هذه الصفحة.</Notice>
            ) : (
              <ul className="divide-y">
                {list.data.map(row => (
                  <li
                    key={row.orderId}
                    className="py-3 flex flex-wrap justify-between gap-3"
                  >
                    <span>
                      طلب #{row.orderId} — {fulfillmentLabels[row.state]} —{" "}
                      {row.pharmacyName ?? "لم تُحدد صيدلية"}
                    </span>
                    {row.state === "assignment_pending" && (
                      <Button
                        variant="outline"
                        disabled={busy}
                        onClick={() => setSelected(row.orderId)}
                      >
                        اختيار صيدلية للطلب #{row.orderId}
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            )}
            <Pager
              count={list.data?.length ?? 0}
              limit={25}
              canPrevious={cursor.canPrevious}
              onPrevious={cursor.previous}
              onNext={() => cursor.next(list.data!.at(-1)!.orderId)}
              disabled={busy}
            />
            {current?.state === "assignment_pending" && (
              <AssignPanel
                key={`${current.orderId}:${current.version}`}
                order={current}
                onBusy={setBusy}
              />
            )}
          </>
        )}
      </Panel>
    </Page>
  );
}
function EnrollmentPanel({ onBusy }: { onBusy(busy: boolean): void }) {
  const utils = trpc.useUtils();
  const orders = trpc.admin.orders.useQuery(undefined, liveQuery);
  const [orderId, setOrderId] = useState("");
  const [reason, setReason] = useState("");
  const [draft, setDraft] = useState<Enrollment | null>(null);
  const [message, setMessage] = useState("");
  const candidates = orders.error
    ? []
    : (orders.data?.filter(
        o =>
          o.isSimulated &&
          o.status === "pending" &&
          o.orderNumber.startsWith("SIM-")
      ) ?? []);
  const selected = candidates.find(o => o.id === Number(orderId));
  return (
    <Panel title="إدراج طلب تجريبي صريح">
      <p className="text-sm">
        الاختيار من آخر 100 طلب. يتحقق الخادم من المنتجات الوهمية والسلامة قبل
        الإدراج. لا يحدث إسناد تلقائي.
      </p>
      {message && <Notice>{message}</Notice>}
      {orders.isLoading ? (
        <Feedback loading />
      ) : orders.error ? (
        <Feedback error={orders.error} />
      ) : (
        <>
          {!draft && (
            <form
              className="grid gap-3"
              onSubmit={e => {
                e.preventDefault();
                if (!selected) return;
                const parsed = fulfillmentRequest.safeParse({
                  orderId: selected.id,
                  reason,
                  requestId: crypto.randomUUID(),
                });
                if (parsed.success) setDraft(parsed.data);
              }}
            >
              <label>
                الطلب التجريبي
                <select
                  required
                  className="block w-full border rounded p-2 bg-background"
                  value={orderId}
                  onChange={e => setOrderId(e.target.value)}
                >
                  <option value="">اختر طلبًا</option>
                  {candidates.map(o => (
                    <option key={o.id} value={o.id}>
                      طلب #{o.id} — {o.orderNumber}
                    </option>
                  ))}
                </select>
              </label>
              {!candidates.length && (
                <Notice>لا توجد طلبات تجريبية معلقة في آخر 100 طلب.</Notice>
              )}
              <label>
                سبب الإدراج
                <Input
                  required
                  minLength={3}
                  maxLength={500}
                  value={reason}
                  onChange={e => setReason(e.target.value)}
                />
              </label>
              <Button disabled={!selected || orders.isFetching}>
                مراجعة إدراج الطلب
              </Button>
            </form>
          )}
          {draft && (
            <FulfillmentRequest
              key={draft.requestId}
              request={draft}
              valid={!!selected && !orders.isFetching}
              execute={input => utils.client.fulfillment.enroll.mutate(input)}
              onBusy={onBusy}
              onClose={success => {
                setDraft(null);
                if (success) {
                  setReason("");
                  setMessage(
                    "أُدرج الطلب بانتظار الإسناد. اختر صيدلية مؤهلة من القائمة أدناه."
                  );
                  void utils.fulfillment.invalidate();
                } else void orders.refetch();
              }}
            >
              <p>إدراج الطلب #{draft.orderId} دون إسناده أو تغيير المخزون.</p>
            </FulfillmentRequest>
          )}
        </>
      )}
    </Panel>
  );
}
function AssignPanel({
  order,
  onBusy,
}: {
  order: Managed;
  onBusy(busy: boolean): void;
}) {
  const utils = trpc.useUtils();
  const [org, setOrg] = useState("");
  const [reason, setReason] = useState("");
  const [draft, setDraft] = useState<Assignment | null>(null);
  const eligible = trpc.fulfillment.eligible.useQuery(
    { orderId: order.orderId, limit: 50 },
    liveQuery
  );
  const selected = eligible.error
    ? undefined
    : eligible.data?.find(o => o.organizationId === Number(org));
  return (
    <Panel title={`اختيار صيدلية للطلب #${order.orderId}`}>
      <p className="text-sm">
        الصيدليات المؤهلة من أول 50 صيدلية معتمدة: إدارة نشطة ومخزون كافٍ. يعيد
        الخادم الفحص عند الإسناد.
      </p>
      {eligible.isLoading ? (
        <Feedback loading />
      ) : eligible.error ? (
        <Feedback error={eligible.error} />
      ) : (
        <>
          {!eligible.data?.length && (
            <Notice>لا توجد صيدلية مؤهلة ضمن هذه المجموعة.</Notice>
          )}
          {!draft && (
            <form
              className="grid gap-3"
              onSubmit={e => {
                e.preventDefault();
                if (!selected) return;
                const parsed = fulfillmentAssignSchema.safeParse({
                  orderId: order.orderId,
                  organizationId: selected.organizationId,
                  expectedVersion: order.version,
                  reason,
                  requestId: crypto.randomUUID(),
                });
                if (parsed.success) setDraft(parsed.data);
              }}
            >
              <label>
                الصيدلية المؤهلة
                <select
                  required
                  className="block w-full border rounded p-2 bg-background"
                  value={org}
                  onChange={e => setOrg(e.target.value)}
                >
                  <option value="">اختر صيدلية</option>
                  {eligible.data?.map(o => (
                    <option key={o.organizationId} value={o.organizationId}>
                      {o.name} — #{o.organizationId}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                سبب الإسناد
                <Input
                  required
                  minLength={3}
                  maxLength={500}
                  value={reason}
                  onChange={e => setReason(e.target.value)}
                />
              </label>
              <Button disabled={!selected || eligible.isFetching}>
                مراجعة الإسناد والحجز
              </Button>
            </form>
          )}
          {draft && (
            <FulfillmentRequest
              key={draft.requestId}
              request={draft}
              valid={
                !!selected &&
                !eligible.isFetching &&
                draft.expectedVersion === order.version
              }
              execute={input => utils.client.fulfillment.assign.mutate(input)}
              onBusy={onBusy}
              onClose={success => {
                setDraft(null);
                if (success) {
                  void utils.fulfillment.invalidate();
                  void utils.pharmacies.inventory.invalidate();
                } else void eligible.refetch();
              }}
            >
              <p>
                طلب #{order.orderId} — الصيدلية #{draft.organizationId} — إصدار{" "}
                {draft.expectedVersion}. سيُحجز مخزون هذه الصيدلية داخل
                المعاملة.
              </p>
            </FulfillmentRequest>
          )}
        </>
      )}
    </Panel>
  );
}
