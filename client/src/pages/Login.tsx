import { useState } from "react";
import { useLocation, useSearch } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import {
  customerEmailSchema,
  customerRegisterSchema,
  customerAuthMessages,
} from "@shared/customer-auth";
import {
  authErrorMessage,
  clearAccountCache,
  consumeRecoveryFragment,
} from "@/lib/auth-feedback";
import PasswordRecovery from "./PasswordRecovery";
import { clearNativeRemindersForLogout } from "@/lib/manual-notifications";
import { prepareAccountChange } from "@/lib/account-lifecycle";
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
  const [phone, setPhone] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [validationError, setValidationError] = useState("");
  const search = useSearch();
  const recoveryMode = new URLSearchParams(search).get("mode") === "reset";
  const [recoveryToken] = useState(() =>
    successPath === "/products" && recoveryMode
      ? consumeRecoveryFragment(window.location, window.history)
      : ""
  );
  const queryClient = useQueryClient();
  const [, navigate] = useLocation();
  const utils = trpc.useUtils();
  const onSuccess = async () => {
    await clearAccountCache(queryClient);
    await utils.auth.me.fetch();
    navigate(successPath);
  };
  const onMutate = () => prepareAccountChange(clearNativeRemindersForLogout);
  const login = trpc.auth.login.useMutation({ onSuccess, onMutate });
  const signup = trpc.auth.register.useMutation({ onSuccess, onMutate });
  const busy = login.isPending || signup.isPending;
  if (successPath === "/products" && recoveryMode)
    return <PasswordRecovery mode="reset" initialToken={recoveryToken} />;
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
              noValidate
              aria-busy={busy}
              onSubmit={e => {
                e.preventDefault();
                if (busy) return;
                setValidationError("");
                login.reset();
                signup.reset();
                if (register) {
                  const parsed = customerRegisterSchema.safeParse({
                    email,
                    password,
                    name,
                    phone,
                    language: "ar",
                  });
                  if (!parsed.success) {
                    setValidationError(parsed.error.issues[0].message);
                    return;
                  }
                  if (password !== confirmPassword) {
                    setValidationError(customerAuthMessages.confirmation);
                    return;
                  }
                  signup.mutate(parsed.data);
                } else {
                  const parsed = customerEmailSchema.safeParse(email);
                  if (!parsed.success) {
                    setValidationError(customerAuthMessages.email);
                    return;
                  }
                  if (!password || password.length > 128) {
                    setValidationError(
                      "أدخل كلمة المرور / Enter your password"
                    );
                    return;
                  }
                  login.mutate({
                    email: parsed.data,
                    password,
                    language: "ar",
                  });
                }
              }}
            >
              {register && (
                <>
                  <label className="customer-login__field">
                    <span className="customer-login__label">الاسم / Name</span>
                    <input
                      required
                      minLength={2}
                      maxLength={100}
                      placeholder="Name / الاسم"
                      autoComplete="name"
                      value={name}
                      onChange={e => setName(e.target.value)}
                    />
                  </label>
                  <label className="customer-login__field">
                    <span className="customer-login__label">
                      رقم الجوال (اختياري) / Phone (optional)
                    </span>
                    <input
                      type="tel"
                      maxLength={40}
                      autoComplete="tel"
                      placeholder="Phone (optional) / الجوال (اختياري)"
                      value={phone}
                      onChange={e => setPhone(e.target.value)}
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
                  minLength={register ? 12 : 1}
                  maxLength={128}
                  autoComplete={register ? "new-password" : "current-password"}
                  placeholder="Password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                />
              </label>
              {register && (
                <label className="customer-login__field">
                  <span className="customer-login__label">
                    تأكيد كلمة المرور / Confirm password
                  </span>
                  <input
                    type="password"
                    required
                    maxLength={128}
                    autoComplete="new-password"
                    placeholder="Confirm password / تأكيد كلمة المرور"
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                  />
                </label>
              )}
              {!register && (
                <button
                  className="customer-login__forgot"
                  type="button"
                  disabled={busy}
                  onClick={() => navigate("/forgot-password")}
                >
                  Forgot your password?
                </button>
              )}
              {(validationError || login.error || signup.error) && (
                <p className="customer-login__message" dir="auto" role="alert">
                  {validationError ||
                    authErrorMessage(
                      login.error ?? signup.error,
                      register ? "register" : "login"
                    )}
                </p>
              )}
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
              إنشاء حساب عميل متاح دون دعوة. استخدم بيانات خيالية في النسخة
              التجريبية، دون معلومات طبية. كلمة المرور الجديدة من 12 إلى 128
              حرفاً.
            </p>
            <p className="customer-login__signup">
              {register ? "Already have an account?" : "Don't have an account?"}{" "}
              <button
                type="button"
                disabled={busy}
                aria-label={register ? "لدي حساب" : "إنشاء حساب عميل"}
                onClick={() => {
                  setRegister(!register);
                  setValidationError("");
                  setPassword("");
                  setConfirmPassword("");
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
