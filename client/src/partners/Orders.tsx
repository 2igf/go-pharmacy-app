import { useState, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Feedback } from "@/components/BetaLayout";
import {
  fulfillmentActions,
  fulfillmentLabels,
  fulfillmentTransition,
  fulfillmentMutationSchema,
} from "@shared/fulfillment";
import type { z } from "zod";
import { Panel, Notice, Pager, useCursor, liveQuery } from "./common";
import { portalPermissions, type Membership } from "./policy";
import { FulfillmentRequest } from "./FulfillmentRequest";
type Mutation = z.infer<typeof fulfillmentMutationSchema>;
export default function PharmacyOrders({
  member,
  onBusy,
}: {
  member: Membership;
  onBusy(busy: boolean): void;
}) {
  const config = trpc.fulfillment.configuration.useQuery(undefined, liveQuery);
  if (config.isLoading) return <Feedback loading />;
  if (config.error) return <Feedback error={config.error} />;
  if (!config.data?.enabled)
    return <Notice>تنفيذ الطلبات التجريبية غير مفعّل على هذا الخادم.</Notice>;
  return <AssignedOrders member={member} onBusy={onBusy} />;
}
function AssignedOrders({
  member,
  onBusy,
}: {
  member: Membership;
  onBusy(busy: boolean): void;
}) {
  const cursor = useCursor();
  const [selected, setSelected] = useState<number>();
  const [busy, setBusy] = useState(false);
  const list = trpc.fulfillment.list.useQuery(
    {
      organizationId: member.organizationId,
      afterOrderId: cursor.value,
      limit: 25,
    },
    liveQuery
  );
  const setOperationBusy = useCallback(
    (value: boolean) => {
      setBusy(value);
      onBusy(value);
    },
    [onBusy]
  );
  return (
    <>
      <Panel title="الطلبات التجريبية المسندة">
        <p>
          طلبات هذه الصيدلية فقط. الكمية المتاحة في المخزون تستثني الكميات
          المحجوزة لهذه الطلبات.
        </p>
        {list.isLoading ? (
          <Feedback loading />
        ) : list.error ? (
          <Feedback error={list.error} />
        ) : (
          <>
            {!list.data?.length ? (
              <Notice>لا توجد طلبات مسندة في هذه الصفحة.</Notice>
            ) : (
              <ul className="divide-y">
                {list.data.map(order => (
                  <li
                    key={order.orderId}
                    className="py-3 flex flex-wrap justify-between gap-3"
                  >
                    <span>
                      طلب #{order.orderId} — {fulfillmentLabels[order.state]}
                    </span>
                    <Button
                      variant="outline"
                      disabled={busy}
                      onClick={() => setSelected(order.orderId)}
                    >
                      عرض الطلب #{order.orderId}
                    </Button>
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
            {selected && list.data?.some(x => x.orderId === selected) && (
              <OrderDetail
                key={selected}
                orderId={selected}
                member={member}
                onBusy={setOperationBusy}
              />
            )}
          </>
        )}
      </Panel>
    </>
  );
}
function OrderDetail({
  orderId,
  member,
  onBusy,
}: {
  orderId: number;
  member: Membership;
  onBusy(busy: boolean): void;
}) {
  const utils = trpc.useUtils();
  const detail = trpc.fulfillment.detail.useQuery(
    { orderId, organizationId: member.organizationId },
    liveQuery
  );
  const [reason, setReason] = useState("");
  const [action, setAction] =
    useState<(typeof fulfillmentActions)[number]>("accept");
  const [draft, setDraft] = useState<Mutation | null>(null);
  const [message, setMessage] = useState("");
  const [formError, setFormError] = useState("");
  if (detail.isLoading) return <Feedback loading />;
  if (detail.error) return <Feedback error={detail.error} />;
  const order = detail.data;
  if (!order) return null;
  const available = fulfillmentActions.filter(a => {
    try {
      fulfillmentTransition(order.state, a);
      return true;
    } catch {
      return false;
    }
  });
  const canWrite = portalPermissions(member).adjust;
  return (
    <Panel title={`تفاصيل الطلب التجريبي #${order.orderId}`}>
      <p>
        {fulfillmentLabels[order.state]} — إصدار {order.version}
      </p>
      <p dir="ltr" className="break-all text-sm">
        {order.orderNumber}
      </p>
      <ul className="divide-y">
        {order.items.map(item => (
          <li key={item.productId} className="py-2">
            {item.productName} — {item.quantity} وحدة —{" "}
            {item.reservationState === "held"
              ? "محجوزة"
              : item.reservationState === "consumed"
                ? "اكتمل التحضير التجريبي"
                : "أُعيدت للمخزون"}
          </li>
        ))}
      </ul>
      {message && <Notice>{message}</Notice>}
      {formError && <Notice error>{formError}</Notice>}
      {canWrite && available.length > 0 && !draft && (
        <form
          className="grid gap-3"
          onSubmit={e => {
            e.preventDefault();
            const parsed = fulfillmentMutationSchema.safeParse({
              orderId,
              organizationId: member.organizationId,
              action: available.includes(action) ? action : available[0],
              reason,
              expectedVersion: order.version,
              requestId: crypto.randomUUID(),
            });
            if (!parsed.success) {
              setFormError("أدخل سببًا صالحًا من 3 إلى 500 حرف.");
              return;
            }
            setFormError("");
            setDraft(parsed.data);
          }}
        >
          <label>
            الإجراء التالي
            <select
              className="block w-full border rounded p-2 bg-background"
              value={available.includes(action) ? action : available[0]}
              onChange={e => setAction(e.target.value as typeof action)}
            >
              {available.map(a => (
                <option key={a} value={a}>
                  {
                    {
                      accept: "قبول الطلب",
                      reject: "رفض الطلب وإرجاع الحجز",
                      prepare: "بدء التحضير",
                      ready: "جاهز للتوصيل التجريبي",
                    }[a]
                  }
                </option>
              ))}
            </select>
          </label>
          <label>
            سبب الإجراء
            <Input
              required
              minLength={3}
              maxLength={500}
              value={reason}
              onChange={e => setReason(e.target.value)}
            />
          </label>
          <Button disabled={detail.isFetching}>مراجعة الإجراء</Button>
        </form>
      )}
      {!canWrite && (
        <Notice>صلاحية عرض فقط. لا يمكنك تغيير حالة التنفيذ.</Notice>
      )}
      {draft && (
        <FulfillmentRequest
          key={draft.requestId}
          request={draft}
          valid={!detail.isFetching && draft.expectedVersion === order.version}
          execute={input => utils.client.fulfillment.transition.mutate(input)}
          onBusy={onBusy}
          onClose={success => {
            setDraft(null);
            if (success) {
              setReason("");
              setMessage("تم تسجيل الإجراء وتحديث الطلب وسجل النشاط.");
              void utils.fulfillment.invalidate();
              void utils.pharmacies.inventory.invalidate();
            } else void detail.refetch();
          }}
        >
          <p>
            طلب #{order.orderId} — الحالة الحالية{" "}
            {fulfillmentLabels[order.state]} — الإصدار {draft.expectedVersion}
          </p>
        </FulfillmentRequest>
      )}
      <h3 className="font-semibold">سجل تنفيذ الطلب</h3>
      <p className="text-sm">
        آخر 50 إجراء مصرحًا لهذه الصيدلية. السجل للقراءة فقط.
      </p>
      <ul className="divide-y">
        {order.events.map(event => (
          <li key={event.id} className="py-2 text-sm">
            <strong>{event.action}</strong> — الحساب #{event.actorUserId} —{" "}
            {new Date(event.createdAt).toLocaleString("ar-JO")}
            <p>{event.reason}</p>
          </li>
        ))}
      </ul>
      {order.handoff && (
        <Notice>
          جاهز لعقد التسليم المستقبلي. لم يُعيّن سائق ولم يُفعّل توصيل فعلي.
        </Notice>
      )}
    </Panel>
  );
}
