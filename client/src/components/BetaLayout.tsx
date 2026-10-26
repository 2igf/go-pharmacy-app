import type { ReactNode } from "react";
import { Link } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
export function BetaLayout({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  return (
    <>
      <div
        className="bg-amber-100 text-amber-950 text-center p-3 text-sm"
        role="note"
      >
        نسخة تجريبية خاصة — جميع الطلبات محاكاة. لا دفع أو توصيل أو صرف أدوية.
        استخدم بيانات خيالية فقط.
      </div>
      <nav
        aria-label="التنقل الرئيسي"
        className="flex flex-wrap justify-center gap-5 border-b p-4 bg-white"
      >
        <Link href="/">الرئيسية</Link>
        <Link href="/products">المنتجات</Link>
        <Link href="/cart">السلة</Link>
        <Link href="/profile">حسابي وطلباتي</Link>
        {user && <Link href="/notifications">الإشعارات</Link>}
        {user?.role === "admin" && <Link href="/admin">الإدارة</Link>}
        {!user && <Link href="/login">تسجيل الدخول</Link>}
      </nav>
      {children}
    </>
  );
}
export function Page({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <main className="max-w-4xl mx-auto p-4 sm:p-6 space-y-5">
      <h1 className="text-2xl font-bold">{title}</h1>
      {children}
    </main>
  );
}
export function Feedback({
  loading,
  error,
}: {
  loading?: boolean;
  error?: { message: string } | null;
}) {
  return (
    <>
      {loading && <p role="status">جار التحميل…</p>}
      {error && (
        <p role="alert" className="text-red-700 p-3 bg-red-50">
          {error.message}
        </p>
      )}
    </>
  );
}
