import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { isAndroid } from "@/lib/api-fetch";
import {
  consumeReminderOpen,
  listenForReminderOpen,
  manualReminderAccountKey,
  manualReminderQueryKey,
  manualReminderSync,
  nativeReminderDefinitions,
  reportManualReminderSyncFailure,
  type ReminderOpenEvent,
} from "@/lib/manual-notifications";

/** App-owned manual reminders only. Never reads or schedules the legacy clinical domain. */
export default function ReminderSync() {
  const auth = trpc.auth.me.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
  });
  const client = trpc.useUtils().client;
  const queryClient = useQueryClient();
  const [, navigate] = useLocation();
  const authenticated =
    auth.isSuccess &&
    !auth.isFetching &&
    !auth.error &&
    auth.data?.role === "user";
  const userId = authenticated ? auth.data!.id : undefined;
  const accountKey = userId ? manualReminderAccountKey(userId) : null;
  const list = useQuery({
    queryKey: [...manualReminderQueryKey(accountKey), "list"],
    queryFn: ({ signal }) =>
      client.manualReminders.list.query(undefined, { signal }),
    enabled: isAndroid() && !!accountKey,
    retry: false,
    staleTime: 0,
    gcTime: 0,
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    if (!isAndroid()) return;
    if (auth.isPending || auth.isFetching || auth.error) {
      manualReminderSync.suspend();
      return;
    }
    if (!auth.isSuccess) return;
    if (!accountKey) {
      void manualReminderSync.logout().catch(reportManualReminderSyncFailure);
      return;
    }
    void manualReminderSync
      .activate(accountKey, auth.dataUpdatedAt)
      .catch(reportManualReminderSyncFailure);
    void queryClient.invalidateQueries({
      queryKey: [...manualReminderQueryKey(accountKey), "list"],
    });
  }, [
    accountKey,
    auth.isPending,
    auth.isFetching,
    auth.error,
    auth.isSuccess,
    auth.dataUpdatedAt,
    queryClient,
  ]);

  useEffect(() => {
    if (!isAndroid() || !userId || !accountKey) return;
    const definitions = nativeReminderDefinitions(
      list.data ?? [],
      userId,
      authenticated &&
        list.isSuccess &&
        !list.isFetching &&
        !list.error &&
        list.dataUpdatedAt >= auth.dataUpdatedAt
    );
    if (definitions)
      void manualReminderSync
        .synchronize(accountKey, definitions)
        .catch(reportManualReminderSyncFailure);
  }, [
    accountKey,
    userId,
    authenticated,
    auth.dataUpdatedAt,
    list.data,
    list.isSuccess,
    list.isFetching,
    list.error,
    list.dataUpdatedAt,
  ]);

  useEffect(() => {
    if (!isAndroid()) return;
    const refresh = () => {
      if (document.hidden) return;
      void auth.refetch();
      void queryClient.invalidateQueries({ queryKey: ["manual-reminders"] });
    };
    document.addEventListener("visibilitychange", refresh);
    window.addEventListener("focus", refresh);
    return () => {
      document.removeEventListener("visibilitychange", refresh);
      window.removeEventListener("focus", refresh);
    };
  }, [auth.refetch, queryClient]);

  useEffect(() => {
    if (
      !isAndroid() ||
      !accountKey ||
      !userId ||
      !authenticated ||
      !list.isSuccess ||
      list.isFetching ||
      list.error ||
      list.dataUpdatedAt < auth.dataUpdatedAt
    )
      return;
    let live = true;
    const open = (event: ReminderOpenEvent) => {
      if (
        !live ||
        event.accountKey !== accountKey ||
        !list.data.some(
          item =>
            item.id === event.reminderId &&
            item.userId === userId &&
            item.enabled
        )
      )
        return;
      navigate(`/reminders/${event.reminderId}`);
    };
    const subscription = listenForReminderOpen(open);
    void subscription.catch(reportManualReminderSyncFailure);
    void consumeReminderOpen()
      .then(open)
      .catch(reportManualReminderSyncFailure);
    return () => {
      live = false;
      void subscription
        .then(handle => handle.remove())
        .catch(reportManualReminderSyncFailure);
    };
  }, [
    accountKey,
    userId,
    authenticated,
    list.data,
    list.isSuccess,
    list.isFetching,
    list.error,
    list.dataUpdatedAt,
    auth.dataUpdatedAt,
    navigate,
  ]);
  return null;
}
