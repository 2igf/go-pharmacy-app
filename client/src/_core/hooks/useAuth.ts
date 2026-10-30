import { getLoginUrl } from "@/const";
import { trpc } from "@/lib/trpc";
import { TRPCClientError } from "@trpc/client";
import { useCallback, useEffect, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { clearNativeRemindersForLogout } from "@/lib/manual-notifications";
import { clearAccountCache } from "@/lib/auth-feedback";
import { completeAccountLogout } from "@/lib/account-lifecycle";
import { toast } from "sonner";

type UseAuthOptions = {
  redirectOnUnauthenticated?: boolean;
  redirectPath?: string;
};

export function useAuth(options?: UseAuthOptions) {
  const { redirectOnUnauthenticated = false, redirectPath = getLoginUrl() } =
    options ?? {};
  const utils = trpc.useUtils();
  const queryClient = useQueryClient();

  const meQuery = trpc.auth.me.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
  });

  const logoutMutation = trpc.auth.logout.useMutation({
    onSuccess: () => {
      utils.auth.me.setData(undefined, null);
    },
  });

  const logout = useCallback(async () => {
    try {
      const result = await completeAccountLogout(
        clearNativeRemindersForLogout,
        async () => {
          try {
            await logoutMutation.mutateAsync();
          } catch (error) {
            if (
              !(
                error instanceof TRPCClientError &&
                error.data?.code === "UNAUTHORIZED"
              )
            )
              throw error;
          }
        },
        async () => {
          await clearAccountCache(queryClient);
          utils.auth.me.setData(undefined, null);
        }
      );
      if (result.localCleanupFailed)
        toast.warning(
          "تم إنهاء جلسة الخادم، لكن تعذر إلغاء تنبيهات الجهاز. أعد فتح التطبيق لإكمال التنظيف قبل تبديل الحساب."
        );
    } catch (error: unknown) {
      toast.error(
        "تعذر تأكيد إنهاء جلسة الخادم. تحقق من الاتصال وأعد تسجيل الخروج."
      );
    }
  }, [logoutMutation, utils, queryClient]);

  const state = useMemo(() => {
    return {
      user: meQuery.data ?? null,
      loading: meQuery.isLoading || logoutMutation.isPending,
      error: meQuery.error ?? logoutMutation.error ?? null,
      isAuthenticated: Boolean(meQuery.data),
    };
  }, [
    meQuery.data,
    meQuery.error,
    meQuery.isLoading,
    logoutMutation.error,
    logoutMutation.isPending,
  ]);

  useEffect(() => {
    if (!redirectOnUnauthenticated) return;
    if (meQuery.isLoading || logoutMutation.isPending) return;
    if (state.user) return;
    if (typeof window === "undefined") return;
    if (window.location.pathname === redirectPath) return;

    window.location.href = redirectPath;
  }, [
    redirectOnUnauthenticated,
    redirectPath,
    logoutMutation.isPending,
    meQuery.isLoading,
    state.user,
  ]);

  return {
    ...state,
    refresh: () => meQuery.refetch(),
    logout,
  };
}
