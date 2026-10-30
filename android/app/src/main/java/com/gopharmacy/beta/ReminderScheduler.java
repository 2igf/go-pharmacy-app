package com.gopharmacy.beta;

import android.Manifest;
import android.app.AlarmManager;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;
import org.json.JSONArray;
import org.json.JSONObject;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.TimeZone;
import java.util.UUID;

/** App-owned local reminders: no network, dose history, background service, or exact-alarm access. */
final class ReminderScheduler {
    static final Object LOCK = new Object();
    static final String ALARM_ACTION = "com.gopharmacy.beta.REMINDER_ALARM";
    static final String OPEN_ACTION = "com.gopharmacy.beta.REMINDER_OPEN";
    static final String NOTIFICATION_TAG = "go_manual_reminders_v2";
    static final String CHANNEL = "go_manual_reminders_v2";
    private final Context context;
    private final ReminderStore store;
    private final AlarmManager alarms;
    private final NotificationManager notifications;

    ReminderScheduler(Context context) {
        this.context = context.getApplicationContext();
        store = new ReminderStore(this.context);
        alarms = this.context.getSystemService(AlarmManager.class);
        notifications = this.context.getSystemService(NotificationManager.class);
        if (Build.VERSION.SDK_INT >= 26) {
            NotificationChannel channel = new NotificationChannel(CHANNEL, "التذكيرات الصحية", NotificationManager.IMPORTANCE_DEFAULT);
            channel.setDescription("تذكيرات صحية تضيفها وتديرها بنفسك");
            channel.setLockscreenVisibility(Notification.VISIBILITY_PRIVATE);
            notifications.createNotificationChannel(channel);
        }
    }

    String permission() {
        if (Build.VERSION.SDK_INT >= 33 && context.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
            return context.getSharedPreferences("go_reminders_permission", Context.MODE_PRIVATE).getBoolean("requested", false) ? "denied" : "prompt";
        }
        if (!NotificationManagerCompat.from(context).areNotificationsEnabled()) return "denied";
        if (Build.VERSION.SDK_INT >= 26 && notifications.getNotificationChannel(CHANNEL).getImportance() == NotificationManager.IMPORTANCE_NONE) return "denied";
        return "granted";
    }

    void markPermissionRequested() { context.getSharedPreferences("go_reminders_permission", Context.MODE_PRIVATE).edit().putBoolean("requested", true).apply(); }

    static int strictInt(JSONObject value, String key) throws Exception {
        Object raw = value.get(key);
        if (!(raw instanceof Number) || ((Number) raw).doubleValue() != ((Number) raw).intValue()) throw new IllegalArgumentException("Invalid integer field");
        return ((Number) raw).intValue();
    }

    private static boolean strictBoolean(JSONObject value, String key) throws Exception {
        Object raw = value.get(key);
        if (!(raw instanceof Boolean)) throw new IllegalArgumentException("Invalid boolean field");
        return (Boolean) raw;
    }

    static ReminderDefinition definition(JSONObject value) throws Exception {
        Object name = value.get("medicationName"), start = value.get("startDate"), end = value.opt("endDate");
        if (!(name instanceof String) || !(start instanceof String) || (end != null && end != JSONObject.NULL && !(end instanceof String)))
            throw new IllegalArgumentException("Invalid reminder text");
        JSONArray rawTimes = value.getJSONArray("times"), rawDays = value.getJSONArray("weekdays");
        List<String> times = new ArrayList<>();
        List<Integer> days = new ArrayList<>();
        if (rawTimes.length() > 8 || rawDays.length() > 7) throw new IllegalArgumentException("Reminder schedule exceeds limits");
        for (int i = 0; i < rawTimes.length(); i++) {
            if (!(rawTimes.get(i) instanceof String)) throw new IllegalArgumentException("Invalid time");
            times.add(rawTimes.getString(i));
        }
        for (int i = 0; i < rawDays.length(); i++) {
            Object raw = rawDays.get(i);
            if (!(raw instanceof Number) || ((Number) raw).doubleValue() != ((Number) raw).intValue()) throw new IllegalArgumentException("Invalid weekday");
            days.add(((Number) raw).intValue());
        }
        return new ReminderDefinition(strictInt(value, "id"), (String) name, times, days, (String) start,
                end == null || end == JSONObject.NULL ? null : (String) end, strictBoolean(value, "enabled"), strictBoolean(value, "discreet"));
    }

    private JSONObject read() {
        try {
            JSONObject state = store.read();
            if (!state.has("accountKey")) return new JSONObject();
            ReminderDefinition.validateAccount(state.getString("accountKey"));
            JSONArray entries = state.getJSONArray("entries");
            if (entries.length() > 20) throw new IllegalArgumentException("Too many stored reminders");
            Set<Integer> ids = new HashSet<>(), nativeIds = new HashSet<>();
            for (int i = 0; i < entries.length(); i++) {
                JSONObject entry = entries.getJSONObject(i);
                ReminderDefinition def = definition(entry);
                if (!ids.add(def.id) || entry.getInt("nativeId") <= 0 || !nativeIds.add(entry.getInt("nativeId"))
                        || !entry.getString("token").matches("[0-9a-f-]{36}")) throw new IllegalArgumentException("Invalid stored identity");
            }
            return state;
        } catch (Exception invalidOrUnavailableKey) {
            // Never post plaintext or stale state when integrity or Keystore access fails.
            store.clear();
            cancelDelivered();
            return new JSONObject();
        }
    }

    JSONObject synchronize(String account, JSONArray reminders) throws Exception {
        synchronized (LOCK) {
            ReminderDefinition.validateAccount(account);
            if (reminders == null || reminders.length() > 20) throw new IllegalArgumentException("At most 20 reminders are allowed");
            List<JSONObject> sorted = new ArrayList<>();
            Set<Integer> reminderIds = new HashSet<>();
            for (int i = 0; i < reminders.length(); i++) {
                JSONObject input = reminders.getJSONObject(i);
                ReminderDefinition def = definition(input);
                if (!reminderIds.add(def.id)) throw new IllegalArgumentException("Duplicate reminder id");
                // Persist only the explicit allow-list, never arbitrary bridge payload fields.
                sorted.add(new JSONObject().put("id", def.id).put("medicationName", def.medicationName)
                        .put("times", new JSONArray(def.times)).put("weekdays", new JSONArray(def.weekdays))
                        .put("startDate", def.startDate).put("endDate", def.endDate == null ? JSONObject.NULL : def.endDate)
                        .put("enabled", def.enabled).put("discreet", def.discreet));
            }
            sorted.sort(Comparator.comparingInt(value -> value.optInt("id")));
            Set<Integer> used = new HashSet<>();
            JSONArray entries = new JSONArray();
            for (JSONObject entry : sorted) {
                int nativeId = ReminderDefinition.reserveId(ReminderDefinition.notificationId(account, entry.getInt("id")), used);
                entry.put("nativeId", nativeId).put("token", UUID.randomUUID().toString()).put("next", 0L);
                entries.put(entry);
            }
            JSONObject previous = read();
            cancelEntries(previous, true);
            JSONObject state = new JSONObject().put("accountKey", account).put("entries", entries);
            // A fresh web query can synchronize before the cold-start navigation consumer mounts.
            JSONObject pendingOpen = previous.optJSONObject("pendingOpen");
            if (account.equals(previous.optString("accountKey")) && pendingOpen != null && account.equals(pendingOpen.optString("accountKey"))) {
                for (JSONObject entry : sorted) {
                    if (entry.getInt("id") == pendingOpen.optInt("reminderId") && entry.getBoolean("enabled")) {
                        state.put("pendingOpen", pendingOpen);
                        break;
                    }
                }
            }
            try {
                store.write(state);
                schedule(state);
                return status(state);
            } catch (Exception error) {
                cancelEntries(state, true);
                store.clear();
                throw error;
            }
        }
    }

    void restore() throws Exception {
        synchronized (LOCK) {
            JSONObject state = read();
            if (!state.has("accountKey")) return;
            try { schedule(state); }
            catch (Exception error) { cancelEntries(state, true); store.clear(); throw error; }
        }
    }

    private void schedule(JSONObject state) throws Exception {
        JSONArray entries = state.getJSONArray("entries");
        long now = System.currentTimeMillis();
        boolean allowed = "granted".equals(permission());
        for (int i = 0; i < entries.length(); i++) {
            JSONObject entry = entries.getJSONObject(i);
            cancelAlarm(entry);
            Long next = allowed ? definition(entry).next(now, TimeZone.getDefault()) : null;
            entry.put("next", next == null ? 0L : next);
            if (next != null) alarms.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, next,
                    alarmIntent(entry, PendingIntent.FLAG_UPDATE_CURRENT));
        }
        if (!allowed) cancelDelivered();
        store.write(state);
    }

    JSONObject status() throws Exception { synchronized (LOCK) { return status(read()); } }

    private JSONObject status(JSONObject state) throws Exception {
        String permission = permission();
        int scheduled = 0;
        if ("granted".equals(permission())) {
            JSONArray entries = state.optJSONArray("entries");
            if (entries != null) for (int i = 0; i < entries.length(); i++) if (entries.getJSONObject(i).optLong("next") > 0) scheduled++;
        }
        JSONObject result = new JSONObject().put("permission", permission).put("scheduled", scheduled);
        if (state.has("accountKey")) result.put("accountKey", state.getString("accountKey"));
        return result;
    }

    void clear() throws Exception {
        synchronized (LOCK) {
            cancelEntries(read(), true);
            cancelDelivered();
            store.clear();
        }
    }

    private void cancelDelivered() {
        for (android.service.notification.StatusBarNotification n : notifications.getActiveNotifications())
            if (NOTIFICATION_TAG.equals(n.getTag())) notifications.cancel(NOTIFICATION_TAG, n.getId());
    }

    private void cancelEntries(JSONObject state, boolean delivered) throws Exception {
        JSONArray entries = state.optJSONArray("entries");
        if (entries == null) return;
        for (int i = 0; i < entries.length(); i++) {
            JSONObject entry = entries.getJSONObject(i);
            cancelAlarm(entry);
            PendingIntent tap = PendingIntent.getActivity(context, entry.getInt("nativeId"), openIntent(entry), PendingIntent.FLAG_NO_CREATE | PendingIntent.FLAG_IMMUTABLE);
            if (tap != null) tap.cancel();
            if (delivered) notifications.cancel(NOTIFICATION_TAG, entry.getInt("nativeId"));
        }
    }

    PendingIntent alarmIntent(JSONObject entry, int flags) throws Exception {
        Intent alarm = new Intent(context, ReminderReceiver.class).setAction(ALARM_ACTION)
                .setData(Uri.parse("goreminder://alarm/" + entry.getInt("nativeId")))
                .putExtra("reminderId", entry.getInt("id")).putExtra("token", entry.getString("token")).putExtra("at", entry.optLong("next"));
        return PendingIntent.getBroadcast(context, entry.getInt("nativeId"), alarm, flags | PendingIntent.FLAG_IMMUTABLE);
    }

    private void cancelAlarm(JSONObject entry) throws Exception {
        PendingIntent pending = alarmIntent(entry, PendingIntent.FLAG_NO_CREATE);
        if (pending != null) { alarms.cancel(pending); pending.cancel(); }
    }

    Intent openIntent(JSONObject entry) throws Exception {
        return new Intent(context, MainActivity.class).setAction(OPEN_ACTION)
                .setData(Uri.parse("goreminder://open/" + entry.getInt("nativeId")))
                .setFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP)
                .putExtra("reminderId", entry.getInt("id")).putExtra("token", entry.getString("token"));
    }

    Notification notification(JSONObject entry) throws Exception {
        ReminderDefinition def = definition(entry);
        PendingIntent tap = PendingIntent.getActivity(context, entry.getInt("nativeId"), openIntent(entry), PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        Notification publicVersion = new NotificationCompat.Builder(context, CHANNEL).setSmallIcon(android.R.drawable.ic_popup_reminder)
                .setContentTitle("GO Pharmacy").setContentText(ReminderDefinition.PUBLIC_BODY).setVisibility(NotificationCompat.VISIBILITY_PUBLIC).build();
        return new NotificationCompat.Builder(context, CHANNEL).setSmallIcon(android.R.drawable.ic_popup_reminder)
                .setContentTitle("GO Pharmacy").setContentText(def.notificationBody()).setVisibility(NotificationCompat.VISIBILITY_PRIVATE)
                .setPublicVersion(publicVersion).setContentIntent(tap).setAutoCancel(true).setOnlyAlertOnce(false)
                .setCategory(NotificationCompat.CATEGORY_REMINDER).build();
    }

    void fire(Intent intent) throws Exception {
        synchronized (LOCK) {
            JSONObject state = read();
            JSONObject entry = matchingEntry(state, intent);
            if (entry == null || entry.optLong("next") <= 0 || entry.optLong("next") != intent.getLongExtra("at", -1)
                    || System.currentTimeMillis() < entry.optLong("next")) return;
            boolean allowed = "granted".equals(permission()) && definition(entry).withinDateRange(System.currentTimeMillis(), TimeZone.getDefault());
            // Advance/persist before delivery: duplicate broadcasts cannot post the same occurrence twice.
            Long next = allowed ? definition(entry).next(System.currentTimeMillis(), TimeZone.getDefault()) : null;
            cancelAlarm(entry);
            entry.put("next", next == null ? 0L : next);
            store.write(state);
            if (next != null) alarms.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, next, alarmIntent(entry, PendingIntent.FLAG_UPDATE_CURRENT));
            if (allowed) notifications.notify(NOTIFICATION_TAG, entry.getInt("nativeId"), notification(entry));
        }
    }

    private JSONObject matchingEntry(JSONObject state, Intent intent) throws Exception {
        if (intent == null || intent.getComponent() == null || !context.getPackageName().equals(intent.getComponent().getPackageName())) return null;
        String action = intent.getAction();
        boolean open = OPEN_ACTION.equals(action);
        if (!open && !ALARM_ACTION.equals(action)) return null;
        if (!(open ? MainActivity.class.getName() : ReminderReceiver.class.getName()).equals(intent.getComponent().getClassName())) return null;
        JSONArray entries = state.optJSONArray("entries");
        if (entries == null) return null;
        for (int i = 0; i < entries.length(); i++) {
            JSONObject entry = entries.getJSONObject(i);
            if (entry.getInt("id") == intent.getIntExtra("reminderId", -1) && entry.getBoolean("enabled")
                    && entry.getString("token").equals(intent.getStringExtra("token"))
                    && Uri.parse("goreminder://" + (open ? "open/" : "alarm/") + entry.getInt("nativeId")).equals(intent.getData())) return entry;
        }
        return null;
    }

    JSONObject acceptOpen(Intent intent) throws Exception {
        synchronized (LOCK) {
            if (intent == null || !OPEN_ACTION.equals(intent.getAction())) return null;
            JSONObject state = read();
            JSONObject entry = matchingEntry(state, intent);
            intent.removeExtra("token"); // Do not replay Activity.getIntent() on rotation/reload.
            if (entry == null) return null;
            JSONObject event = new JSONObject().put("reminderId", entry.getInt("id")).put("accountKey", state.getString("accountKey"));
            state.put("pendingOpen", event);
            store.write(state);
            notifications.cancel(NOTIFICATION_TAG, entry.getInt("nativeId"));
            return event;
        }
    }

    JSONObject consumeOpen() throws Exception {
        synchronized (LOCK) {
            JSONObject state = read();
            JSONObject event = state.optJSONObject("pendingOpen");
            if (event == null) return new JSONObject();
            state.remove("pendingOpen");
            store.write(state);
            if (!state.optString("accountKey").equals(event.optString("accountKey"))) return new JSONObject();
            JSONArray entries = state.getJSONArray("entries");
            for (int i = 0; i < entries.length(); i++) {
                JSONObject entry = entries.getJSONObject(i);
                if (entry.getInt("id") == event.optInt("reminderId") && entry.getBoolean("enabled")) return event;
            }
            return new JSONObject();
        }
    }
}
