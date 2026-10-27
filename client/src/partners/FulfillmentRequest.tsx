import { useEffect, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Feedback } from "@/components/BetaLayout";
import { ConfirmAction, Notice } from "./common";
import { isDefinitiveStockError } from "./policy";

/** One immutable reviewed payload/UUID. Ambiguous failures retry that exact request. */
export function FulfillmentRequest<
  T extends { requestId: string; reason: string },
>({
  request,
  execute,
  valid,
  onClose,
  onBusy,
  children,
}: {
  request: T;
  execute(input: T): Promise<unknown>;
  valid: boolean;
  onClose(success: boolean): void;
  onBusy?(busy: boolean): void;
  children: ReactNode;
}) {
  const [mode, setMode] = useState<"review" | "retry" | "failed">("review");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  useEffect(() => {
    onBusy?.(busy);
    return () => onBusy?.(false);
  }, [busy, onBusy]);
  async function send() {
    setBusy(true);
    setError(null);
    setMode("retry");
    try {
      await execute(request);
      onClose(true);
    } catch (e) {
      setError(e instanceof Error ? e : new Error("تعذر تنفيذ الطلب"));
      if (isDefinitiveStockError(e)) setMode("failed");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="space-y-3">
      <Feedback error={error} loading={busy} />
      {mode === "review" && !valid && (
        <Notice error>
          تغيرت البيانات أو تعذر تحديثها. ألغِ المراجعة وأعد تحميل الطلب.
        </Notice>
      )}
      {mode === "retry" && !busy && (
        <>
          <Notice>
            النتيجة غير مؤكدة. تعيد المحاولة الطلب نفسه ومعرّفه؛ لا تُنشئ عملية
            أخرى.
          </Notice>
          <Button onClick={() => void send()}>إعادة الطلب نفسه</Button>
        </>
      )}
      {!busy && (
        <Button variant="outline" onClick={() => onClose(false)}>
          {mode === "failed" ? "إغلاق وإعادة المراجعة" : "إلغاء المراجعة"}
        </Button>
      )}
      <ConfirmAction
        manualConfirmClose
        open={mode === "review" && valid && !busy}
        title="تأكيد إجراء تنفيذ تجريبي"
        onCancel={() => onClose(false)}
        onConfirm={() => void send()}
      >
        {children}
        <p>السبب: {request.reason}</p>
        <p>محاكاة فقط — لا صرف أدوية أو دفع أو توصيل فعلي.</p>
      </ConfirmAction>
    </div>
  );
}
