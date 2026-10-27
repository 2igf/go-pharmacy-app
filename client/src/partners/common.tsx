import { useEffect, useState, type ReactNode } from "react";
import {
  QueryClient,
  QueryClientProvider,
  useQuery,
} from "@tanstack/react-query";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";
import type { Membership } from "./policy";

/** Ephemeral cache: mount keyed by account/org, clear on unmount. Same API client. */
export function PrivateQueryScope({ children }: { children: ReactNode }) {
  const client = trpc.useUtils().client;
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            retry: false,
            staleTime: 0,
            gcTime: 0,
            refetchOnWindowFocus: true,
          },
        },
      })
  );
  useEffect(() => () => queryClient.clear(), [queryClient]);
  return (
    <trpc.Provider client={client} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </trpc.Provider>
  );
}
export function useMemberships(userId: number) {
  const client = trpc.useUtils().client;
  return useQuery({
    queryKey: ["partners-memberships", userId],
    refetchInterval: 5000,
    queryFn: async ({ signal }) => {
      const all: Membership[] = [];
      let afterId = 0;
      for (;;) {
        const page = await client.pharmacies.mine.query(
          { afterId, limit: 100 },
          { signal }
        );
        all.push(...page);
        if (page.length < 100) return all;
        const next = page.at(-1)!.organizationId;
        if (next <= afterId) throw new Error("تعذر تحميل قائمة العضويات.");
        afterId = next;
      }
    },
  });
}
export const liveQuery = { retry: false, refetchInterval: 5000 } as const;
export function Panel({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-xl border bg-card p-4 sm:p-6 space-y-4">
      <h2 className="text-lg font-semibold">{title}</h2>
      {children}
    </section>
  );
}
export function Notice({
  children,
  error = false,
}: {
  children: ReactNode;
  error?: boolean;
}) {
  return (
    <p
      role={error ? "alert" : "status"}
      className={
        error
          ? "rounded-lg border border-red-200 bg-red-50 text-red-800 p-3"
          : "rounded-lg bg-muted p-3 text-sm"
      }
    >
      {children}
    </p>
  );
}
export function Pager({
  count,
  limit,
  onNext,
  onPrevious,
  canPrevious,
  disabled = false,
}: {
  count: number;
  limit: number;
  onNext(): void;
  onPrevious(): void;
  canPrevious: boolean;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center gap-3">
      <Button
        variant="outline"
        onClick={onPrevious}
        disabled={disabled || !canPrevious}
      >
        السابق
      </Button>
      <span className="text-sm">{count} سجل في الصفحة</span>
      <Button
        variant="outline"
        onClick={onNext}
        disabled={disabled || count < limit}
      >
        التالي
      </Button>
    </div>
  );
}
export function ConfirmAction({
  open,
  title,
  children,
  onCancel,
  onConfirm,
  manualConfirmClose = false,
}: {
  open: boolean;
  title: string;
  children: ReactNode;
  onCancel(): void;
  onConfirm(): void;
  manualConfirmClose?: boolean;
}) {
  return (
    <AlertDialog
      open={open}
      onOpenChange={value => {
        if (!value) onCancel();
      }}
    >
      <AlertDialogContent dir="rtl">
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="text-sm space-y-2">{children}</div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onCancel}>رجوع</AlertDialogCancel>
          {manualConfirmClose ? (
            <Button onClick={onConfirm}>تأكيد العملية</Button>
          ) : (
            <AlertDialogAction onClick={onConfirm}>
              تأكيد العملية
            </AlertDialogAction>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
export function useCursor(initial = 0) {
  const [pages, setPages] = useState([initial]);
  return {
    value: pages.at(-1)!,
    previous: () => setPages(p => (p.length > 1 ? p.slice(0, -1) : p)),
    reset: () => setPages([initial]),
    next: (id: number) => setPages(p => [...p, id]),
    canPrevious: pages.length > 1,
  };
}
