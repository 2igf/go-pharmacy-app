import { useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Page, Feedback } from "@/components/BetaLayout";
export default function Login() {
  const [register, setRegister] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [, navigate] = useLocation();
  const utils = trpc.useUtils();
  const onSuccess = async () => {
    await utils.auth.me.invalidate();
    navigate("/products");
  };
  const login = trpc.auth.login.useMutation({ onSuccess });
  const signup = trpc.auth.register.useMutation({ onSuccess });
  const busy = login.isPending || signup.isPending;
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
