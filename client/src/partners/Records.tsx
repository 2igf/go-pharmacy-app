import { trpc } from "@/lib/trpc";
import { Feedback } from "@/components/BetaLayout";
import { Panel, Notice, Pager, liveQuery, useCursor } from "./common";
import {
  roleLabels,
  memberStatusLabels,
  statusLabels,
  type Outputs,
} from "./policy";

export function Members({
  organizationId,
  onEdit,
}: {
  organizationId: number;
  onEdit?(member: Outputs["pharmacies"]["members"]["list"][number]): void;
}) {
  const cursor = useCursor();
  const query = trpc.pharmacies.members.list.useQuery(
    { organizationId, afterUserId: cursor.value, limit: 50 },
    liveQuery
  );
  return (
    <Panel title="أعضاء الصيدلية">
      <p className="text-sm text-muted-foreground">
        عرض الأعضاء المخوّل فقط. تعيين العضويات وتغيير حالتها متاحان للإدارة عبر
        واجهتها المحمية.
      </p>
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
                  <th className="p-3">الحساب</th>
                  <th>الدور</th>
                  <th>حالة العضوية</th>
                  {onEdit && <th>الإجراء الإداري</th>}
                </tr>
              </thead>
              <tbody>
                {query.data?.map(m => (
                  <tr key={m.userId} className="border-t">
                    <td className="p-3">#{m.userId}</td>
                    <td>{roleLabels[m.role]}</td>
                    <td>{memberStatusLabels[m.status]}</td>
                    {onEdit && (
                      <td>
                        <button
                          className="text-primary underline"
                          onClick={() => onEdit(m)}
                        >
                          تحرير العضوية
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!query.data?.length && (
            <Notice>لا توجد عضويات في هذه الصفحة.</Notice>
          )}
          <Pager
            count={query.data?.length ?? 0}
            limit={50}
            canPrevious={cursor.canPrevious}
            onPrevious={cursor.previous}
            onNext={() => cursor.next(query.data!.at(-1)!.userId)}
          />
        </>
      )}
    </Panel>
  );
}
const actions = {
  organization_applied: "تقديم طلب صيدلية",
  organization_reviewed: "مراجعة المؤسسة",
  membership_updated: "تعديل عضوية",
  stock_adjusted: "تعديل المخزون",
};
function detailsText(value: unknown) {
  if (!value || typeof value !== "object") return "";
  const d = value as Record<string, unknown>;
  if (typeof d.productId === "number")
    return `المنتج #${d.productId}: من ${d.previousQuantity} إلى ${d.quantity} وحدة، الفرق ${d.delta}، الإصدار ${d.version}`;
  const state = (value: unknown): string => {
    if (typeof value === "string")
      return (
        ({ ...statusLabels, ...memberStatusLabels } as Record<string, string>)[
          value
        ] ?? value
      );
    if (!value || typeof value !== "object") return "—";
    const item = value as Record<string, unknown>;
    return `${roleLabels[item.role as keyof typeof roleLabels] ?? "—"} / ${memberStatusLabels[item.status as keyof typeof memberStatusLabels] ?? "—"}`;
  };
  return `${typeof d.userId === "number" ? `الحساب #${d.userId} — ` : ""}من ${state(d.before)} إلى ${state(d.after ?? d.status)}`;
}
export function Activity({ organizationId }: { organizationId: number }) {
  const cursor = useCursor();
  const query = trpc.pharmacies.audit.list.useQuery(
    { organizationId, beforeId: cursor.value || undefined, limit: 50 },
    liveQuery
  );
  return (
    <Panel title="سجل النشاط">
      <p className="text-sm text-muted-foreground">
        سجل للقراءة فقط. تُعرض معرّفات الحسابات المتاحة دون بريد أو بيانات
        اعتماد.
      </p>
      {query.isLoading ? (
        <Feedback loading />
      ) : query.error ? (
        <Feedback error={query.error} />
      ) : (
        <>
          {!query.data?.length && <Notice>لا توجد أحداث في هذه الصفحة.</Notice>}
          <ol className="space-y-3">
            {query.data?.map(event => (
              <li key={event.id} className="border rounded-lg p-4 space-y-2">
                <div className="flex flex-wrap justify-between gap-2">
                  <strong>{actions[event.action]}</strong>
                  <time className="text-sm">
                    {new Date(event.createdAt).toLocaleString("ar-JO")}
                  </time>
                </div>
                <p className="text-sm">
                  بواسطة الحساب #{event.actorUserId} • حدث #{event.id}
                </p>
                <p>{event.reason}</p>
                <p className="text-sm text-muted-foreground break-words">
                  {detailsText(event.details)}
                </p>
              </li>
            ))}
          </ol>
          <Pager
            count={query.data?.length ?? 0}
            limit={50}
            canPrevious={cursor.canPrevious}
            onPrevious={cursor.previous}
            onNext={() => cursor.next(query.data!.at(-1)!.id)}
          />
        </>
      )}
    </Panel>
  );
}
