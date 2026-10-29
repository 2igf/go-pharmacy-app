import { Link, useLocation } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { customerNavigation } from "./policy";
import "./customer.css";

export default function CustomerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [path] = useLocation();
  const { user } = useAuth();
  const login = path === "/login";
  return (
    <div
      className={`customer-app ${login ? "customer-auth-surface" : ""}`}
      dir="rtl"
    >
      <div className="customer-content">
        {children}
        {!login && (
          <details className="canva-beta-notice">
            <summary>نسخة تجريبية — الطلبات محاكاة فقط</summary>
            <p>لا دفع أو توصيل أو صرف أدوية. استخدم بيانات خيالية فقط.</p>
            <div>
              {!user && <Link href="/login">تسجيل الدخول</Link>}
              {user && <Link href="/notifications">الإشعارات</Link>}
              {user?.role === "admin" && <Link href="/admin">الإدارة</Link>}
            </div>
          </details>
        )}
      </div>
      {!login && (
        <>
          <nav className="canva-bottom-nav" aria-label="التنقل الرئيسي">
            {customerNavigation.map(item => {
              const active =
                path === item.href ||
                (item.href === "/cart" && path === "/checkout") ||
                (item.href === "/products" && path.startsWith("/product")) ||
                (item.href === "/profile" &&
                  ["/addresses", "/notifications"].includes(path));
              return (
                <Link
                  href={item.href}
                  key={item.href}
                  aria-current={active ? "page" : undefined}
                  aria-label={
                    item.unavailable
                      ? `${item.label} — غير متاح حاليًا`
                      : item.label
                  }
                >
                  <img src={`/canva/nav-${item.icon}.png`} alt="" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </>
      )}
    </div>
  );
}
