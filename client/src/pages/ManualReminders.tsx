import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "../../../server/routers";
import { trpc } from "@/lib/trpc";
import {
  createReminderSchema,
  updateReminderSchema,
} from "@shared/customer-reminders";
import {
  MANUAL_REMINDER_STATUS_EVENT,
  MANUAL_REMINDER_SYNC_ERROR_EVENT,
  manualNotificationStatus,
  manualReminderAccountKey,
  manualReminderQueryKey,
  manualReminderSyncError,
  recentManualOccurrences,
  requestManualNotificationPermission,
} from "@/lib/manual-notifications";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import "@/customer/reminder.css";

type Reminder = inferRouterOutputs<AppRouter>["manualReminders"]["detail"];
const weekdays = [
  "الأحد",
  "الاثنين",
  "الثلاثاء",
  "الأربعاء",
  "الخميس",
  "الجمعة",
  "السبت",
];
const deviceTimezone = () => Intl.DateTimeFormat().resolvedOptions().timeZone;
function today() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
function reminderFailure(error: unknown) {
  const code = (error as { data?: { code?: string } } | null)?.data?.code;
  if (code === "CONFLICT")
    return "تغيّرت البيانات أو سبق تسجيل هذا الموعد. حدّث الصفحة قبل إعادة المحاولة.";
  if (code === "PRECONDITION_FAILED")
    return "وصلت إلى حد التذكيرات. أوقف تذكيراً أو احذفه ثم أعد المحاولة.";
  if (code === "NOT_FOUND") return "التذكير غير موجود أو غير متاح لهذا الحساب.";
  if (code === "FORBIDDEN" || code === "UNAUTHORIZED")
    return "سجّل الدخول بحساب العميل للوصول إلى تذكيراتك.";
  if (code === "BAD_REQUEST")
    return "راجع الجدول والوقت. التسجيل اليدوي متاح لموعد مجدول سابق خلال سبعة أيام وبعد إنشاء التذكير، عندما يكون مفعّلاً.";
  return "تعذر إكمال الطلب. تحقق من اتصالك ثم حدّث القائمة قبل المحاولة مجدداً.";
}
function editable(reminder: Reminder) {
  return {
    medicationName: reminder.medicationName,
    dosage: reminder.dosage,
    notes: reminder.notes,
    times: reminder.times,
    weekdays: reminder.weekdays,
    startDate: reminder.startDate,
    endDate: reminder.endDate,
    timezone: reminder.timezone,
    enabled: reminder.enabled,
    discreet: reminder.discreet,
  };
}

function NotificationSettings({ accountKey }: { accountKey: string }) {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<Awaited<
    ReturnType<typeof manualNotificationStatus>
  > | null>(null);
  const [error, setError] = useState(manualReminderSyncError);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let live = true;
    const refresh = () => {
      void manualNotificationStatus()
        .then(value => {
          if (live) {
            setStatus(value);
            setError(manualReminderSyncError());
          }
        })
        .catch(() => {
          if (live) setError("تعذر قراءة حالة إشعارات الجهاز. أعد المحاولة.");
        });
    };
    const failed = () => setError(manualReminderSyncError());
    const updated = () => refresh();
    refresh();
    window.addEventListener(MANUAL_REMINDER_STATUS_EVENT, updated);
    window.addEventListener(MANUAL_REMINDER_SYNC_ERROR_EVENT, failed);
    return () => {
      live = false;
      window.removeEventListener(MANUAL_REMINDER_STATUS_EVENT, updated);
      window.removeEventListener(MANUAL_REMINDER_SYNC_ERROR_EVENT, failed);
    };
  }, []);
  return (
    <section className="manual-reminders__notice" aria-label="إشعارات الجهاز">
      <h2>إشعارات الجهاز</h2>
      {status?.platform === "web" ? (
        <p>
          يمكن حفظ وإدارة التذكيرات عبر المتصفح. التنبيهات المحلية تعمل داخل
          تطبيق Android فقط؛ لم تُجدول إشعارات في المتصفح.
        </p>
      ) : (
        <>
          <p>
            {!status
              ? "جار قراءة إذن الإشعارات…"
              : status.permission === "granted"
                ? `الإذن متاح. عدد التنبيهات المجدولة على الجهاز: ${status.scheduled}. الجدولة لا تثبت ظهور التنبيه أو تناول الدواء.`
                : status.permission === "denied"
                  ? "إذن الإشعارات مرفوض. فعّله من إعدادات التطبيق في Android ثم ارجع إلى هذه الصفحة."
                  : "إذن الإشعارات لم يُمنح بعد. يمكنك طلبه بالزر التالي."}
          </p>
          <button
            type="button"
            disabled={busy || !status}
            onClick={async () => {
              setBusy(true);
              setError("");
              try {
                setStatus(await requestManualNotificationPermission());
                await queryClient.invalidateQueries({
                  queryKey: manualReminderQueryKey(accountKey),
                });
              } catch {
                setError(
                  "تعذر تحديث إذن الإشعارات. راجع إعدادات التطبيق ثم أعد المحاولة."
                );
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy
              ? "جار التحديث…"
              : status?.permission === "granted"
                ? "تحديث حالة الإشعارات"
                : "طلب إذن الإشعارات"}
          </button>
        </>
      )}
      {error && <p role="alert">{error}</p>}
      <p>
        تتبع التنبيهات وقت الجهاز الحالي عند السفر أو تغيير المنطقة الزمنية. قد
        تتأخر بسبب البطارية أو قيود النظام. الإيقاف القسري قد يمنعها حتى فتح
        التطبيق مجدداً. لا نطلب إذن المنبهات الدقيقة.
      </p>
    </section>
  );
}

function ReminderForm({
  reminder,
  accountKey,
}: {
  reminder?: Reminder;
  accountKey: string;
}) {
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const [requestId] = useState(() => crypto.randomUUID());
  const [medicationName, setName] = useState(reminder?.medicationName ?? "");
  const [dosage, setDosage] = useState(reminder?.dosage ?? "");
  const [notes, setNotes] = useState(reminder?.notes ?? "");
  const [times, setTimes] = useState(reminder?.times ?? ["08:00"]);
  const [days, setDays] = useState(reminder?.weekdays ?? [0, 1, 2, 3, 4, 5, 6]);
  const [startDate, setStart] = useState(reminder?.startDate ?? today());
  const [endDate, setEnd] = useState(reminder?.endDate ?? "");
  const [enabled, setEnabled] = useState(reminder?.enabled ?? true);
  const [discreet, setDiscreet] = useState(reminder?.discreet ?? true);
  const [validation, setValidation] = useState("");
  const onSuccess = async (row: Reminder) => {
    await queryClient.invalidateQueries({
      queryKey: manualReminderQueryKey(accountKey),
    });
    navigate(`/reminders/${row.id}`);
  };
  const create = trpc.manualReminders.create.useMutation({ onSuccess });
  const update = trpc.manualReminders.update.useMutation({ onSuccess });
  const busy = create.isPending || update.isPending;
  return (
    <form
      className="manual-reminders__form"
      noValidate
      aria-busy={busy}
      onSubmit={event => {
        event.preventDefault();
        if (busy) return;
        setValidation("");
        create.reset();
        update.reset();
        const fields = {
          medicationName,
          dosage,
          notes,
          times,
          weekdays: days,
          startDate,
          endDate: endDate || null,
          timezone: deviceTimezone(),
          enabled,
          discreet,
        };
        if (reminder) {
          const parsed = updateReminderSchema.safeParse({
            ...fields,
            id: reminder.id,
            version: reminder.version,
          });
          if (!parsed.success)
            return setValidation(parsed.error.issues[0].message);
          update.mutate(parsed.data);
        } else {
          const parsed = createReminderSchema.safeParse({
            ...fields,
            requestId,
          });
          if (!parsed.success)
            return setValidation(parsed.error.issues[0].message);
          create.mutate(parsed.data);
        }
      }}
    >
      <label>
        اسم الدواء الذي تدخله يدوياً
        <input
          required
          maxLength={120}
          value={medicationName}
          onChange={event => setName(event.target.value)}
          autoComplete="off"
        />
      </label>
      <label>
        نص الجرعة كما حدده المختص (اختياري)
        <input
          maxLength={120}
          value={dosage}
          onChange={event => setDosage(event.target.value)}
          autoComplete="off"
        />
      </label>
      <label>
        ملاحظاتك (اختياري)
        <textarea
          maxLength={500}
          value={notes}
          onChange={event => setNotes(event.target.value)}
        />
      </label>
      <fieldset>
        <legend>أوقات التذكير — حسب وقت جهازك</legend>
        {times.map((time, index) => (
          <div className="manual-reminders__time" key={index}>
            <label>
              الوقت {index + 1}
              <input
                type="time"
                required
                value={time}
                onChange={event =>
                  setTimes(previous =>
                    previous.map((item, itemIndex) =>
                      itemIndex === index ? event.target.value : item
                    )
                  )
                }
              />
            </label>
            <button
              type="button"
              disabled={times.length === 1 || busy}
              onClick={() =>
                setTimes(previous =>
                  previous.filter((_, itemIndex) => itemIndex !== index)
                )
              }
              aria-label={`حذف الوقت ${index + 1}`}
            >
              حذف الوقت
            </button>
          </div>
        ))}
        <button
          type="button"
          disabled={times.length >= 8 || busy}
          onClick={() => setTimes(previous => [...previous, ""])}
        >
          إضافة وقت آخر
        </button>
      </fieldset>
      <fieldset>
        <legend>أيام الأسبوع</legend>
        <div className="manual-reminders__weekdays">
          {weekdays.map((day, index) => (
            <label key={day}>
              <input
                type="checkbox"
                checked={days.includes(index)}
                onChange={event =>
                  setDays(previous =>
                    event.target.checked
                      ? [...previous, index]
                      : previous.filter(value => value !== index)
                  )
                }
              />
              {day}
            </label>
          ))}
        </div>
      </fieldset>
      <div className="manual-reminders__dates">
        <label>
          تاريخ البداية
          <input
            type="date"
            min="1970-01-01"
            required
            value={startDate}
            onChange={event => setStart(event.target.value)}
          />
        </label>
        <label>
          تاريخ النهاية (اختياري)
          <input
            type="date"
            min={startDate >= "1970-01-01" ? startDate : "1970-01-01"}
            value={endDate}
            onChange={event => setEnd(event.target.value)}
          />
        </label>
      </div>
      <label className="manual-reminders__checkbox">
        <input
          type="checkbox"
          checked={enabled}
          onChange={event => setEnabled(event.target.checked)}
        />
        التذكير مفعّل
      </label>
      <label className="manual-reminders__checkbox">
        <input
          type="checkbox"
          checked={discreet}
          onChange={event => setDiscreet(event.target.checked)}
        />
        تنبيه خاص دون اسم الدواء على شاشة القفل
      </label>
      <p>
        منطقة الجهاز عند الحفظ: <bdi>{deviceTimezone()}</bdi>. تنبيهات Android
        تتبع وقت الجهاز عند تغيّره.
      </p>
      {(validation || create.error || update.error) && (
        <p role="alert">
          {validation || reminderFailure(create.error ?? update.error)}
        </p>
      )}
      <button type="submit" disabled={busy}>
        {busy ? "جار الحفظ…" : "حفظ التذكير"}
      </button>
      <Link href={reminder ? `/reminders/${reminder.id}` : "/reminders"}>
        إلغاء والعودة
      </Link>
    </form>
  );
}

function ReminderDetail({
  reminder,
  accountKey,
}: {
  reminder: Reminder;
  accountKey: string;
}) {
  const [, navigate] = useLocation();
  const client = trpc.useUtils().client;
  const queryClient = useQueryClient();
  const [deleting, setDeleting] = useState(false);
  const [selected, setSelected] = useState("");
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);
  const choices = useMemo(
    () => recentManualOccurrences(reminder, now),
    [reminder, now]
  );
  const history = useQuery({
    queryKey: [...manualReminderQueryKey(accountKey), "history", reminder.id],
    queryFn: ({ signal }) =>
      client.manualReminders.history.query(
        { id: reminder.id, limit: 50 },
        { signal }
      ),
    retry: false,
    gcTime: 0,
  });
  const refresh = () =>
    queryClient.invalidateQueries({
      queryKey: manualReminderQueryKey(accountKey),
    });
  const update = trpc.manualReminders.update.useMutation({
    onSuccess: refresh,
  });
  const remove = trpc.manualReminders.remove.useMutation({
    onSuccess: async () => {
      await refresh();
      navigate("/reminders");
    },
  });
  const record = trpc.manualReminders.record.useMutation({
    onSuccess: async () => {
      setSelected("");
      await refresh();
    },
  });
  const busy = update.isPending || remove.isPending || record.isPending;
  return (
    <>
      <article className="manual-reminders__card">
        <h2>{reminder.medicationName}</h2>
        {reminder.dosage && <p>نص الجرعة المدخل: {reminder.dosage}</p>}
        {reminder.notes && (
          <p className="manual-reminders__notes">ملاحظاتك: {reminder.notes}</p>
        )}
        <p>
          الأوقات: <bdi>{reminder.times.join("، ")}</bdi>
        </p>
        <p>الأيام: {reminder.weekdays.map(day => weekdays[day]).join("، ")}</p>
        <p>
          من {reminder.startDate}
          {reminder.endDate ? ` حتى ${reminder.endDate}` : " — دون تاريخ نهاية"}
        </p>
        <p>
          {reminder.enabled ? "مفعّل" : "متوقف"} —{" "}
          {reminder.discreet ? "تنبيه خاص" : "يظهر اسم الدواء بالتنبيه"}
        </p>
        <p>
          منطقة الحفظ: <bdi>{reminder.timezone}</bdi>. منطقة الجهاز الحالية:{" "}
          <bdi>{deviceTimezone()}</bdi>.
        </p>
        <div className="manual-reminders__actions">
          <Link href={`/reminders/${reminder.id}/edit`}>تعديل</Link>
          <button
            type="button"
            disabled={busy}
            onClick={() =>
              update.mutate({
                ...editable(reminder),
                id: reminder.id,
                version: reminder.version,
                enabled: !reminder.enabled,
              })
            }
          >
            {reminder.enabled ? "إيقاف مؤقت" : "تفعيل التذكير"}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => setDeleting(true)}
          >
            حذف التذكير
          </button>
        </div>
      </article>
      <section className="manual-reminders__card">
        <h2>تسجيل إفادة يدوية</h2>
        <p>
          اختَر موعداً سابقاً ثم سجّل إفادتك. ظهور التنبيه أو فتحه لا يسجّل
          تناول الدواء. هذا السجل ليس تحققاً طبياً من الالتزام.
        </p>
        <label>
          الموعد حسب وقت جهازك
          <select
            value={selected}
            onChange={event => {
              setSelected(event.target.value);
              record.reset();
            }}
          >
            <option value="">اختر موعداً من آخر سبعة أيام</option>
            {choices.map(choice => (
              <option key={choice.toISOString()} value={choice.toISOString()}>
                {choice.toLocaleString("ar-JO")}
              </option>
            ))}
          </select>
        </label>
        {!choices.length && (
          <p>لا توجد مواعيد سابقة مؤهلة منذ إنشاء التذكير، أو التذكير متوقف.</p>
        )}
        <div className="manual-reminders__actions">
          <button
            type="button"
            disabled={
              busy ||
              !selected ||
              !choices.some(choice => choice.toISOString() === selected)
            }
            onClick={() =>
              record.mutate({
                id: reminder.id,
                version: reminder.version,
                scheduledAt: selected,
                timezone: deviceTimezone(),
                status: "taken",
              })
            }
          >
            أؤكد أنني تناولته
          </button>
          <button
            type="button"
            disabled={
              busy ||
              !selected ||
              !choices.some(choice => choice.toISOString() === selected)
            }
            onClick={() =>
              record.mutate({
                id: reminder.id,
                version: reminder.version,
                scheduledAt: selected,
                timezone: deviceTimezone(),
                status: "skipped",
              })
            }
          >
            أسجّل أنني تخطيته
          </button>
        </div>
        {record.isSuccess && <p role="status">حُفظت إفادتك اليدوية.</p>}
      </section>
      {(update.error || remove.error || record.error) && (
        <p role="alert">
          {reminderFailure(update.error ?? remove.error ?? record.error)}
        </p>
      )}
      <section className="manual-reminders__card">
        <h2>سجل الإفادات اليدوية</h2>
        {history.isPending ? (
          <p role="status">جار تحميل السجل…</p>
        ) : history.error ? (
          <p role="alert">{reminderFailure(history.error)}</p>
        ) : !history.data?.length ? (
          <p>لا توجد إفادات مسجلة.</p>
        ) : (
          <ol>
            {history.data.map(event => (
              <li key={event.id}>
                <strong>
                  {event.status === "taken"
                    ? "أفاد المستخدم بأنه تناوله"
                    : "أفاد المستخدم بأنه تخطاه"}
                </strong>
                <br />
                <time dateTime={new Date(event.scheduledAt).toISOString()}>
                  {new Date(event.scheduledAt).toLocaleString("ar-JO", {
                    timeZone: event.timezone,
                  })}
                </time>{" "}
                — <bdi>{event.timezone}</bdi>
                <p>
                  المنطقة الزمنية وإفادة التناول من مدخلات المستخدم؛ ليست
                  إثباتاً طبياً أو تحققاً مستقلاً.
                </p>
              </li>
            ))}
          </ol>
        )}
      </section>
      <Dialog open={deleting} onOpenChange={setDeleting}>
        <DialogContent dir="rtl">
          <DialogTitle>حذف التذكير وسجله؟</DialogTitle>
          <DialogDescription>
            سيُحذف هذا التذكير وسجل إفاداتك المرتبط به نهائياً، وستُلغى تنبيهاته
            بعد مزامنة التطبيق. يمكنك إيقافه مؤقتاً بدلاً من الحذف.
          </DialogDescription>
          <button
            type="button"
            disabled={busy}
            onClick={() =>
              remove.mutate({ id: reminder.id, version: reminder.version })
            }
          >
            تأكيد الحذف
          </button>
          <button type="button" onClick={() => setDeleting(false)}>
            إلغاء
          </button>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default function ManualReminders() {
  const [path] = useLocation();
  const auth = trpc.auth.me.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
  });
  const client = trpc.useUtils().client;
  const queryClient = useQueryClient();
  const owner =
    auth.isSuccess && !auth.error && auth.data?.role === "user"
      ? auth.data
      : null;
  const accountKey = owner ? manualReminderAccountKey(owner.id) : null;
  const adding = path === "/reminders/new";
  const editing = /^\/reminders\/[1-9]\d*\/edit$/.test(path);
  const match = /^\/reminders\/([1-9]\d*)(?:\/edit)?$/.exec(path);
  const id = match ? Number(match[1]) : 0;
  const list = useQuery({
    queryKey: [...manualReminderQueryKey(accountKey), "list"],
    queryFn: ({ signal }) =>
      client.manualReminders.list.query(undefined, { signal }),
    enabled: !!owner && !id && !adding,
    retry: false,
    gcTime: 0,
  });
  const detail = useQuery({
    queryKey: [...manualReminderQueryKey(accountKey), "detail", id],
    queryFn: ({ signal }) =>
      client.manualReminders.detail.query({ id }, { signal }),
    enabled: !!owner && !!id,
    retry: false,
    gcTime: 0,
  });
  useEffect(() => {
    if (accountKey)
      void queryClient.invalidateQueries({
        queryKey: manualReminderQueryKey(accountKey),
      });
  }, [accountKey, auth.dataUpdatedAt, queryClient]);
  const row =
    owner &&
    detail.isSuccess &&
    !detail.error &&
    detail.data.userId === owner.id
      ? detail.data
      : null;
  const rows =
    owner &&
    list.isSuccess &&
    !list.error &&
    list.data.every(item => item.userId === owner.id)
      ? list.data
      : null;
  return (
    <main className="manual-reminders" dir="rtl">
      <header>
        <h1>
          {adding
            ? "إضافة تذكير يدوي"
            : editing
              ? "تعديل التذكير"
              : id
                ? "تفاصيل التذكير"
                : "منبه الدواء اليدوي"}
        </h1>
        <Link href="/reminders">قائمة التذكيرات</Link>
      </header>
      <p className="manual-reminders__disclaimer">
        أنت تُدخل الاسم والجرعة والجدول بنفسك وفق تعليمات الطبيب أو الصيدلي.
        التطبيق لا يصف جرعات أو يغيّر العلاج، ولا يوصي بتعويض الجرعات الفائتة.
      </p>
      {auth.isPending ? (
        <p role="status">جار التحقق من الحساب…</p>
      ) : auth.error ? (
        <div role="alert">
          <p>
            تعذر التحقق من الحساب. لم نعرض بيانات محفوظة لحساب غير مؤكد، وتبقى
            التنبيهات المحلية السابقة دون إعادة مزامنة.
          </p>
          <button onClick={() => auth.refetch()} type="button">
            إعادة المحاولة
          </button>
        </div>
      ) : !owner || !accountKey ? (
        <p>
          هذه التذكيرات خاصة بحساب العميل.{" "}
          <Link href="/login">تسجيل الدخول</Link>
        </p>
      ) : (
        <div key={accountKey}>
          <NotificationSettings accountKey={accountKey} />
          {adding ? (
            <ReminderForm accountKey={accountKey} />
          ) : id ? (
            row ? (
              editing ? (
                <ReminderForm
                  key={`${row.id}:${row.version}`}
                  reminder={row}
                  accountKey={accountKey}
                />
              ) : (
                <ReminderDetail
                  key={row.id}
                  reminder={row}
                  accountKey={accountKey}
                />
              )
            ) : detail.error ? (
              <p role="alert">{reminderFailure(detail.error)}</p>
            ) : (
              <p role="status">جار تحميل التذكير…</p>
            )
          ) : (
            <>
              <div className="manual-reminders__actions">
                <Link href="/reminders/new">إضافة تذكير</Link>
                <button type="button" onClick={() => list.refetch()}>
                  تحديث القائمة والتنبيهات
                </button>
              </div>
              {list.error ? (
                <p role="alert">{reminderFailure(list.error)}</p>
              ) : !rows ? (
                <p role="status">جار تحميل تذكيراتك…</p>
              ) : rows.length === 0 ? (
                <p>لا توجد تذكيرات يدوية. يمكنك إضافة جدولك بنفسك.</p>
              ) : (
                <ul className="manual-reminders__list">
                  {rows.map(reminder => (
                    <li key={reminder.id}>
                      <Link href={`/reminders/${reminder.id}`}>
                        <strong>{reminder.medicationName}</strong>
                        <span>
                          {reminder.times.join("، ")} —{" "}
                          {reminder.enabled ? "مفعّل" : "متوقف"}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </div>
      )}
    </main>
  );
}
