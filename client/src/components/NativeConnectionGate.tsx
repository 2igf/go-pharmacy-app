import { useState, type ReactNode } from "react";
import { normalizeApiOrigin } from "@shared/native-api";
import { clearNativeRemindersForLogout } from "@/lib/manual-notifications";
import {
  isAndroid,
  getNativeApiOrigin,
  saveNativeApiOrigin,
  clearNativeApiOrigin,
} from "@/lib/api-fetch";

export function NativeConnectionGate({ children }: { children: ReactNode }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(getNativeApiOrigin() ?? "");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  if (!isAndroid()) return children;
  const origin = getNativeApiOrigin();
  if (origin && !editing)
    return (
      <>
        <div
          data-native-connection-bar
          className="border-b bg-emerald-50 p-2 text-center text-sm"
        >
          <p className="break-all" dir="ltr">
            {origin}
          </p>
          <button className="underline" onClick={() => setEditing(true)}>
            إعداد اتصال التطبيق
          </button>
        </div>
        {children}
      </>
    );
  return (
    <main dir="rtl" className="max-w-lg mx-auto p-6 space-y-5">
      <div className="rounded-2xl bg-[#00c57d] text-white p-5 text-center">
        <h1 className="text-3xl font-bold">GO Pharmacy</h1>
        <p className="mt-2">نسخة Android التجريبية</p>
      </div>
      <h2 className="text-xl font-bold">إعداد الاتصال بالخادم</h2>
      <p>
        الواجهة مثبتة داخل التطبيق. تسجيل الدخول والمنتجات والطلبات تحتاج خادم
        GO Pharmacy منفصلًا عبر HTTPS بشهادة موثوقة.
      </p>
      <p className="bg-amber-100 p-3 rounded">
        جميع الطلبات محاكاة. استخدم بيانات خيالية فقط، ولا تدخل بيانات مرضى أو
        دفع.
      </p>
      <form
        className="space-y-4"
        onSubmit={async event => {
          event.preventDefault();
          if (busy) return;
          let candidate: string;
          try {
            candidate = normalizeApiOrigin(value);
          } catch {
            setError(
              "أدخل عنوان HTTPS صالحًا ومتاحًا للهاتف، دون مسار أو بيانات دخول. localhost هو الهاتف نفسه."
            );
            return;
          }
          setBusy(true);
          setError("");
          try {
            await clearNativeRemindersForLogout();
            saveNativeApiOrigin(candidate);
            location.reload();
          } catch {
            setError(
              "تعذر إلغاء تنبيهات الحساب السابق أو حفظ إعداد الاتصال. لم يُغيّر التطبيق الاتصال ولم يُعد تحميله. أعد المحاولة."
            );
          } finally {
            setBusy(false);
          }
        }}
      >
        <label className="block" htmlFor="api-origin">
          عنوان خادم HTTPS
        </label>
        <input
          id="api-origin"
          type="url"
          dir="ltr"
          required
          value={value}
          onChange={event => setValue(event.target.value)}
          placeholder="https://your-server.example"
          className="w-full border rounded p-3"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
        />
        {error && (
          <p role="alert" className="text-red-700">
            {error}
          </p>
        )}
        <button
          className="w-full rounded p-3 bg-[#00c57d] text-white font-bold"
          type="submit"
          disabled={busy}
        >
          حفظ والاتصال
        </button>
      </form>
      <p className="text-sm">
        اطلب العنوان الصحيح من مشغّل النسخة التجريبية. لا توجد استضافة مُعدّة
        مسبقًا في هذا APK.
      </p>
      {origin && (
        <button className="underline" onClick={() => setEditing(false)}>
          العودة للتطبيق
        </button>
      )}
      {origin && (
        <button
          className="block underline text-red-700"
          disabled={busy}
          onClick={async () => {
            if (busy) return;
            setBusy(true);
            setError("");
            try {
              await clearNativeRemindersForLogout();
              clearNativeApiOrigin();
              location.reload();
            } catch {
              setError(
                "تعذر إلغاء التنبيهات المحلية أو مسح إعداد الاتصال. بقي الاتصال الحالي دون إعادة تحميل. أعد المحاولة."
              );
            } finally {
              setBusy(false);
            }
          }}
        >
          مسح إعداد العنوان
        </button>
      )}
    </main>
  );
}
