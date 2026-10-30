package com.gopharmacy.beta;

import static org.junit.Assert.*;
import android.app.AlarmManager;
import android.app.Notification;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import java.io.File;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import org.json.JSONArray;
import org.json.JSONObject;
import org.junit.After;
import org.junit.Test;
import org.junit.runner.RunWith;

/** Real Android/Keystore/PendingIntent checks. Run only on the dedicated test emulator. */
@RunWith(AndroidJUnit4.class)
public class ReminderSchedulerTest {
    private final Context app = InstrumentationRegistry.getInstrumentation().getTargetContext();
    private final ReminderScheduler scheduler = new ReminderScheduler(app);
    private final String account = "https://test.example|101";

    @After public void cleanup() throws Exception { scheduler.clear(); }

    private JSONArray definitions() throws Exception {
        return new JSONArray().put(new JSONObject().put("id", 7).put("medicationName", "PRIVATE-MEDICINE-NATIVE")
                .put("times", new JSONArray().put("08:00").put("20:00"))
                .put("weekdays", new JSONArray().put(0).put(1).put(2).put(3).put(4).put(5).put(6))
                .put("startDate", "2026-01-01").put("endDate", JSONObject.NULL).put("enabled", true).put("discreet", true));
    }

    @Test public void synchronizationIsBoundedAndClearCancelsPendingAndDelivered() throws Exception {
        JSONObject status = scheduler.synchronize(account, definitions());
        assertEquals(account, status.getString("accountKey"));
        int expected = status.getString("permission").equals("granted") ? 1 : 0;
        assertEquals(expected, status.getInt("scheduled"));
        JSONObject entry = new ReminderStore(app).read().getJSONArray("entries").getJSONObject(0);
        PendingIntent pending = scheduler.alarmIntent(entry, PendingIntent.FLAG_NO_CREATE);
        assertEquals(expected == 1, pending != null);
        scheduler.clear();
        assertEquals(0, scheduler.status().getInt("scheduled"));
        assertFalse(scheduler.status().has("accountKey"));
        assertNull(scheduler.alarmIntent(entry, PendingIntent.FLAG_NO_CREATE));
        for (android.service.notification.StatusBarNotification n : app.getSystemService(NotificationManager.class).getActiveNotifications())
            assertNotEquals(ReminderScheduler.NOTIFICATION_TAG, n.getTag());
    }

    @Test public void accountSwitchCancelsOldIdsAndStaleOrForgedTapCannotOpen() throws Exception {
        scheduler.synchronize(account, definitions());
        JSONObject old = new ReminderStore(app).read().getJSONArray("entries").getJSONObject(0);
        scheduler.synchronize("https://test.example|102", definitions());
        assertNull(scheduler.alarmIntent(old, PendingIntent.FLAG_NO_CREATE));
        Intent forged = new Intent(app, MainActivity.class).setAction(ReminderScheduler.OPEN_ACTION)
                .setData(Uri.parse("goreminder://open/" + old.getInt("nativeId")))
                .putExtra("reminderId", 7).putExtra("token", old.getString("token"));
        assertNull(scheduler.acceptOpen(forged));
        assertFalse(scheduler.consumeOpen().has("reminderId"));
    }

    @Test public void validTapIsConsumedOnceAndDisablingInvalidatesOldTap() throws Exception {
        scheduler.synchronize(account, definitions());
        JSONObject entry = new ReminderStore(app).read().getJSONArray("entries").getJSONObject(0);
        Intent tap = scheduler.openIntent(entry);
        assertEquals(7, scheduler.acceptOpen(tap).getInt("reminderId"));
        assertEquals(account, scheduler.consumeOpen().getString("accountKey"));
        assertFalse(scheduler.consumeOpen().has("reminderId"));
        JSONArray disabled = definitions();
        disabled.getJSONObject(0).put("enabled", false);
        scheduler.synchronize(account, disabled);
        assertNull(scheduler.acceptOpen(scheduler.openIntent(entry)));
    }

    @Test public void coldStartOpenSurvivesSameAccountRefreshAndIsDiscardedOnAccountChange() throws Exception {
        scheduler.synchronize(account, definitions());
        JSONObject entry = new ReminderStore(app).read().getJSONArray("entries").getJSONObject(0);
        scheduler.acceptOpen(scheduler.openIntent(entry));
        scheduler.synchronize(account, definitions());
        assertEquals(7, scheduler.consumeOpen().getInt("reminderId"));
        JSONObject refreshed = new ReminderStore(app).read().getJSONArray("entries").getJSONObject(0);
        scheduler.acceptOpen(scheduler.openIntent(refreshed));
        scheduler.synchronize("https://test.example|102", definitions());
        assertFalse(scheduler.consumeOpen().has("reminderId"));
    }

    @Test public void encryptedCacheNeverContainsPrivateNameOrAccountAndInvalidInputPreservesState() throws Exception {
        scheduler.synchronize(account, definitions());
        File cache = new File(app.getNoBackupFilesDir(), "reminders-v2.enc");
        String cipher = new String(Files.readAllBytes(cache.toPath()), StandardCharsets.ISO_8859_1);
        assertFalse(cipher.contains("PRIVATE-MEDICINE-NATIVE"));
        assertFalse(cipher.contains(account));
        JSONArray invalid = definitions();
        invalid.getJSONObject(0).put("times", new JSONArray().put("25:00"));
        assertThrows(IllegalArgumentException.class, () -> scheduler.synchronize(account, invalid));
        assertEquals(account, scheduler.status().getString("accountKey"));
    }

    @Test public void postedPublicVersionNeverContainsMedication() throws Exception {
        JSONArray privateName = definitions();
        privateName.getJSONObject(0).put("discreet", false);
        scheduler.synchronize(account, privateName);
        JSONObject entry = new ReminderStore(app).read().getJSONArray("entries").getJSONObject(0);
        Notification notification = scheduler.notification(entry);
        assertTrue(notification.extras.getCharSequence(Notification.EXTRA_TEXT).toString().contains("PRIVATE-MEDICINE-NATIVE"));
        assertNotNull(notification.publicVersion);
        assertFalse(notification.publicVersion.extras.getCharSequence(Notification.EXTRA_TEXT).toString().contains("PRIVATE-MEDICINE-NATIVE"));
        assertEquals(Notification.VISIBILITY_PRIVATE, notification.visibility);
    }

    @Test public void androidCalendarSkipsSpringGapAndUsesLaterAutumnOverlap() throws Exception {
        ReminderDefinition gap = new ReminderDefinition(1, "Medicine", java.util.Collections.singletonList("02:30"), java.util.Collections.singletonList(0), "2026-01-01", null, true, true);
        assertEquals(Long.valueOf(1773556200000L), gap.next(1772949600000L, java.util.TimeZone.getTimeZone("America/New_York")));
        ReminderDefinition overlap = new ReminderDefinition(1, "Medicine", java.util.Collections.singletonList("01:30"), java.util.Collections.singletonList(0), "2026-01-01", null, true, true);
        assertEquals(Long.valueOf(1793514600000L), overlap.next(1793505600000L, java.util.TimeZone.getTimeZone("America/New_York")));
    }

    @Test public void bridgeRejectsOversizedPlansAndCoercedTypesBeforeChangingCurrentAccount() throws Exception {
        scheduler.synchronize(account, definitions());
        JSONArray tooMany = new JSONArray();
        for (int i = 1; i <= 21; i++) tooMany.put(definitions().getJSONObject(0).put("id", i));
        assertThrows(IllegalArgumentException.class, () -> scheduler.synchronize("https://test.example|102", tooMany));
        assertEquals(account, scheduler.status().getString("accountKey"));
        JSONArray coerced = definitions();
        coerced.getJSONObject(0).put("id", "7");
        assertThrows(IllegalArgumentException.class, () -> scheduler.synchronize(account, coerced));
        JSONArray fractional = definitions();
        fractional.getJSONObject(0).put("id", 7.5);
        assertThrows(IllegalArgumentException.class, () -> scheduler.synchronize(account, fractional));
    }

    @Test public void delayedFinalDayAlarmCannotPostAfterLocalEndDate() throws Exception {
        org.junit.Assume.assumeTrue("Grant notifications to exercise the stale-delivery guard", "granted".equals(scheduler.permission()));
        JSONArray expired = definitions();
        java.util.Calendar yesterday = java.util.Calendar.getInstance();
        yesterday.add(java.util.Calendar.DAY_OF_MONTH, -1);
        String end = String.format(java.util.Locale.ROOT, "%04d-%02d-%02d", yesterday.get(java.util.Calendar.YEAR), yesterday.get(java.util.Calendar.MONTH) + 1, yesterday.get(java.util.Calendar.DAY_OF_MONTH));
        expired.getJSONObject(0).put("startDate", end).put("endDate", end);
        scheduler.synchronize(account, expired);
        JSONObject state = new ReminderStore(app).read();
        JSONObject entry = state.getJSONArray("entries").getJSONObject(0);
        long oldOccurrence = yesterday.getTimeInMillis();
        entry.put("next", oldOccurrence);
        new ReminderStore(app).write(state);
        // Controlled stale-receiver regression only; this direct call is never delivery evidence.
        scheduler.fire(new Intent(app, ReminderReceiver.class).setAction(ReminderScheduler.ALARM_ACTION)
                .setData(Uri.parse("goreminder://alarm/" + entry.getInt("nativeId")))
                .putExtra("reminderId", entry.getInt("id")).putExtra("token", entry.getString("token")).putExtra("at", oldOccurrence));
        for (android.service.notification.StatusBarNotification n : app.getSystemService(NotificationManager.class).getActiveNotifications())
            assertNotEquals("Expired final-day alarm must not post a stale reminder", ReminderScheduler.NOTIFICATION_TAG, n.getTag());
        assertEquals(0, scheduler.status().getInt("scheduled"));
    }
}
