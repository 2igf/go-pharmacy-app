import { useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Page, Feedback } from "@/components/BetaLayout";
import "@/customer/login.css";
export default function Login({
  successPath = "/products",
}: {
  successPath?:
    | "/products"
    | "/partners/pharmacy"
    | "/admin/pharmacies"
    | "/admin/fulfillment";
}) {
  const [register, setRegister] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [recoveryUnavailable, setRecoveryUnavailable] = useState(false);
  const [, navigate] = useLocation();
  const utils = trpc.useUtils();
  const onSuccess = async () => {
    await utils.auth.me.invalidate();
    navigate(successPath);
  };
  const login = trpc.auth.login.useMutation({ onSuccess });
  const signup = trpc.auth.register.useMutation({ onSuccess });
  const busy = login.isPending || signup.isPending;
  if (successPath === "/products") {
    return (
      <main className="customer-login" dir="ltr">
        <div className="customer-login__surface">
          <img
            className="customer-login__header"
            src="/canva/login-header.png"
            width={528}
            height={375}
            alt="GO Pharmacy"
          />
          <div className="customer-login__body">
            <h1>{register ? "Create your account" : "Welcome Back!"}</h1>
            <form
              className="customer-login__form"
              onSubmit={e => {
                e.preventDefault();
                if (register)
                  signup.mutate({ email, password, name, inviteCode });
                else login.mutate({ email, password });
              }}
            >
              {register && (
                <>
                  <label className="customer-login__field">
                    <span className="customer-login__label">الاسم الخيالي</span>
                    <input
                      required
                      minLength={2}
                      maxLength={100}
                      placeholder="Fictional name"
                      autoComplete="name"
                      value={name}
                      onChange={e => setName(e.target.value)}
                    />
                  </label>
                  <label className="customer-login__field">
                    <span className="customer-login__label">
                      رمز الدعوة الخاص بالبريد
                    </span>
                    <input
                      required
                      minLength={64}
                      maxLength={64}
                      autoComplete="off"
                      placeholder="Invitation code"
                      value={inviteCode}
                      onChange={e => setInviteCode(e.target.value)}
                    />
                  </label>
                </>
              )}
              <label className="customer-login__field">
                <span className="customer-login__label">البريد الإلكتروني</span>
                <input
                  type="email"
                  required
                  autoComplete="username"
                  maxLength={320}
                  placeholder="Email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                />
              </label>
              <label className="customer-login__field">
                <span className="customer-login__label">كلمة المرور</span>
                <input
                  className="customer-login__password"
                  type="password"
                  required
                  minLength={12}
                  maxLength={128}
                  autoComplete={register ? "new-password" : "current-password"}
                  placeholder="Password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                />
              </label>
              {!register && (
                <button
                  className="customer-login__forgot"
                  type="button"
                  onClick={() => setRecoveryUnavailable(true)}
                >
                  Forgot your password?
                </button>
              )}
              {recoveryUnavailable && !register && (
                <p className="customer-login__message" dir="rtl" role="status">
                  استعادة كلمة المرور غير متاحة في النسخة التجريبية. تواصل مع
                  مسؤول الدعوة للمساعدة.
                </p>
              )}
              <div className="customer-login__feedback" dir="rtl">
                <Feedback error={login.error ?? signup.error} />
              </div>
              <button
                className="customer-login__submit"
                disabled={busy}
                type="submit"
                aria-label={
                  busy ? "جار المعالجة…" : register ? "إنشاء الحساب" : "دخول"
                }
              >
                {busy ? "جار المعالجة…" : register ? "Sign Up" : "Log in"}
              </button>
            </form>
            <p className="customer-login__notice" dir="rtl">
              الدخول بالبريد المدعو فقط. استخدم بيانات خيالية، دون معلومات طبية.
            </p>
            <p className="customer-login__signup">
              {register ? "Already have an account?" : "Don't have an account?"}{" "}
              <button
                type="button"
                aria-label={register ? "لدي حساب" : "إنشاء حساب مدعو"}
                onClick={() => {
                  setRegister(!register);
                  setRecoveryUnavailable(false);
                  login.reset();
                  signup.reset();
                }}
              >
                {register ? "Log in" : "Sign Up"}
              </button>
            </p>
          </div>
        </div>
      </main>
    );
  }
  return (
    <Page title={register ? "إنشاء حساب مدعو" : "تسجيل الدخول"}>
      <p>الوصول متاح للبريد المدعو فقط. لا تدخل معلومات طبية.</p>
      <form
        className="space-y-4 max-w-md"
        onSubmit={e => {
          e.preventDefault();
          if (register) signup.mutate({ email, password, name, inviteCode });
          else login.mutate({ email, password });
        }}
      >
        {register && (
          <label className="block">
            الاسم الخيالي
            <Input
              required
              minLength={2}
              maxLength={100}
              value={name}
              onChange={e => setName(e.target.value)}
            />
          </label>
        )}
        {register && (
          <label className="block">
            رمز الدعوة الخاص بالبريد
            <Input
              required
              minLength={64}
              maxLength={64}
              autoComplete="off"
              value={inviteCode}
              onChange={e => setInviteCode(e.target.value)}
            />
          </label>
        )}
        <label className="block">
          البريد الإلكتروني
          <Input
            type="email"
            required
            autoComplete="username"
            maxLength={320}
            value={email}
            onChange={e => setEmail(e.target.value)}
          />
        </label>
        <label className="block">
          كلمة المرور
          <Input
            type="password"
            required
            minLength={12}
            maxLength={128}
            autoComplete={register ? "new-password" : "current-password"}
            value={password}
            onChange={e => setPassword(e.target.value)}
          />
        </label>
        <Feedback error={login.error ?? signup.error} />
        <Button disabled={busy} type="submit">
          {busy ? "جار المعالجة…" : register ? "إنشاء الحساب" : "دخول"}
        </Button>
      </form>
      <Button
        variant="outline"
        onClick={() => {
          setRegister(!register);
          login.reset();
          signup.reset();
        }}
      >
        {register ? "لدي حساب" : "إنشاء حساب مدعو"}
      </Button>
    </Page>
  );
}
