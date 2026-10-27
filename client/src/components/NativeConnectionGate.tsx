import { useState, type ReactNode } from "react";
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
  if (!isAndroid()) return children;
  const origin = getNativeApiOrigin();
  if (origin && !editing)
    return (
      <>
        <div className="border-b bg-emerald-50 p-2 text-center text-sm">
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
        onSubmit={event => {
          event.preventDefault();
          try {
            saveNativeApiOrigin(value);
            location.reload();
          } catch {
            setError(
              "أدخل عنوان HTTPS صالحًا ومتاحًا للهاتف، دون مسار أو بيانات دخول. localhost هو الهاتف نفسه."
            );
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
          onClick={() => {
            clearNativeApiOrigin();
            location.reload();
          }}
        >
          مسح إعداد العنوان
        </button>
      )}
    </main>
  );
}
