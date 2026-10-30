import { useState } from "react";
import { Link } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { trpc } from "@/lib/trpc";
import { clearNativeRemindersForLogout } from "@/lib/manual-notifications";
import { clearCommittedAccountState } from "@/lib/account-lifecycle";
import {
  authErrorMessage,
  clearAccountCache,
  consumeRecoveryFragment,
  recoveryDeliveryMessage,
} from "@/lib/auth-feedback";
import {
  passwordResetRequestSchema,
  passwordResetSchema,
} from "@shared/customer-auth";
import "@/customer/login.css";
import "@/customer/recovery.css";

export default function PasswordRecovery({
  mode = "request",
  initialToken,
}: {
  mode?: "request" | "reset";
  initialToken?: string;
}) {
  const [step, setStep] = useState(mode);
  const [email, setEmail] = useState("");
  const [token, setToken] = useState(
    () =>
      initialToken ?? consumeRecoveryFragment(window.location, window.history)
  );
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [validationError, setValidationError] = useState("");
  const [completed, setCompleted] = useState(false);
  const [localCleanupFailed, setLocalCleanupFailed] = useState(false);
  const queryClient = useQueryClient();
  const request = trpc.auth.requestPasswordReset.useMutation();
  const reset = trpc.auth.resetPassword.useMutation({
    onSuccess: async () => {
      setToken("");
      setPassword("");
      setConfirmPassword("");
      const result = await clearCommittedAccountState(
        clearNativeRemindersForLogout,
        () => clearAccountCache(queryClient)
      );
      setLocalCleanupFailed(result.localCleanupFailed);
      setCompleted(true);
    },
  });
  const busy = request.isPending || reset.isPending;
  const error =
    validationError ||
    ((step === "request" ? request.error : reset.error)
      ? authErrorMessage(step === "request" ? request.error : reset.error, step)
      : "");

  return (
    <main className="customer-login customer-recovery" dir="ltr">
      <div className="customer-login__surface">
        <img
          className="customer-login__header"
          src="/canva/login-header.png"
          width={528}
          height={375}
          alt="GO Pharmacy"
        />
        <div className="customer-login__body">
          <h1>
            {completed
              ? "Password updated / تم تغيير كلمة المرور"
              : step === "request"
                ? "Forgot your password?"
                : "Reset your password"}
          </h1>
          {completed && localCleanupFailed && (
            <p role="alert" dir="rtl">
              تم تغيير كلمة المرور وإلغاء الجلسات. تعذر تنظيف تنبيهات الجهاز؛
              أعد فتح التطبيق لإكمال التنظيف قبل تبديل الحساب.
            </p>
          )}
          {completed ? (
            <p className="customer-recovery__intro" dir="auto" role="status">
              تم إلغاء الجلسات السابقة. سجّل الدخول بكلمة المرور الجديدة /
              Previous sessions were revoked. Sign in with your new password.
            </p>
          ) : (
            <>
              <p className="customer-recovery__intro" dir="auto">
                {step === "request"
                  ? "أدخل البريد المسجل لطلب الاستعادة / Enter your registered email to request recovery."
                  : "الصق الرمز من رسالة الاستعادة ثم اختر كلمة مرور من 12 إلى 128 حرفاً / Paste the code from your recovery message and choose a password of 12 to 128 characters."}
              </p>
              <form
                className="customer-login__form"
                noValidate
                aria-busy={busy}
                onSubmit={e => {
                  e.preventDefault();
                  if (busy) return;
                  setValidationError("");
                  if (step === "request") {
                    request.reset();
                    const parsed = passwordResetRequestSchema.safeParse({
                      email,
                      language: "ar",
                    });
                    if (!parsed.success)
                      return setValidationError(parsed.error.issues[0].message);
                    request.mutate(parsed.data);
                  } else {
                    reset.reset();
                    const parsed = passwordResetSchema.safeParse({
                      token: token.trim(),
                      password,
                      confirmPassword,
                      language: "ar",
                    });
                    if (!parsed.success)
                      return setValidationError(parsed.error.issues[0].message);
                    reset.mutate(parsed.data);
                  }
                }}
              >
                {step === "request" ? (
                  <label className="customer-login__field">
                    <span>البريد الإلكتروني / Email</span>
                    <input
                      type="email"
                      required
                      maxLength={320}
                      autoComplete="email"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                    />
                  </label>
                ) : (
                  <>
                    <label className="customer-login__field">
                      <span>رمز الاستعادة / Recovery code</span>
                      <input
                        type="password"
                        required
                        maxLength={64}
                        autoComplete="off"
                        autoCapitalize="none"
                        spellCheck={false}
                        value={token}
                        onChange={e => setToken(e.target.value)}
                        aria-describedby="recovery-code-help"
                      />
                    </label>
                    <p
                      id="recovery-code-help"
                      className="customer-login__message"
                      dir="auto"
                    >
                      رمز من 64 خانة. يمكنك لصقه هنا داخل التطبيق / 64-character
                      code; you can paste it here in the app.
                    </p>
                    <label className="customer-login__field">
                      <span>كلمة المرور الجديدة / New password</span>
                      <input
                        type="password"
                        required
                        minLength={12}
                        maxLength={128}
                        autoComplete="new-password"
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                      />
                    </label>
                    <label className="customer-login__field">
                      <span>تأكيد كلمة المرور / Confirm password</span>
                      <input
                        type="password"
                        required
                        maxLength={128}
                        autoComplete="new-password"
                        value={confirmPassword}
                        onChange={e => setConfirmPassword(e.target.value)}
                      />
                    </label>
                  </>
                )}
                {error && (
                  <p
                    className="customer-login__message"
                    dir="auto"
                    role="alert"
                  >
                    {error}
                  </p>
                )}
                {request.data && step === "request" && (
                  <p
                    className="customer-login__message"
                    dir="auto"
                    role="status"
                  >
                    {recoveryDeliveryMessage(request.data.delivery)}
                  </p>
                )}
                <button
                  type="submit"
                  className="customer-login__submit"
                  disabled={busy}
                >
                  {busy
                    ? "جار المعالجة… / Please wait…"
                    : step === "request"
                      ? "طلب الاستعادة / Request recovery"
                      : "حفظ كلمة المرور / Save password"}
                </button>
              </form>
              <button
                className="customer-recovery__switch"
                type="button"
                disabled={busy}
                onClick={() => {
                  setStep(step === "request" ? "reset" : "request");
                  setValidationError("");
                  setToken("");
                  setPassword("");
                  setConfirmPassword("");
                  request.reset();
                  reset.reset();
                }}
              >
                {step === "request"
                  ? "لدي رمز استعادة / I have a recovery code"
                  : "طلب رمز جديد / Request a new code"}
              </button>
            </>
          )}
          <Link href="/login" className="customer-recovery__back">
            العودة للدخول / Back to login
          </Link>
        </div>
      </div>
    </main>
  );
}
