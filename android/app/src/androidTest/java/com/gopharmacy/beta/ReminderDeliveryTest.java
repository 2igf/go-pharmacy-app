package com.gopharmacy.beta;

import static org.junit.Assert.*;
import static org.junit.Assume.assumeTrue;
import android.app.NotificationManager;
import android.content.Context;
import android.os.Bundle;
import android.os.SystemClock;
import android.service.notification.StatusBarNotification;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import java.util.Calendar;
import java.util.Locale;
import org.json.JSONArray;
import org.json.JSONObject;
import org.junit.Test;
import org.junit.runner.RunWith;

/** Optional real AlarmManager -> receiver -> status-bar delivery observation, not a timing guarantee. */
@RunWith(AndroidJUnit4.class)
public class ReminderDeliveryTest {
    @Test public void actualInexactAlarmPostsGenericNotificationAndAdvancesOnce() throws Exception {
        Bundle args = InstrumentationRegistry.getArguments();
        assumeTrue("Explicit dedicated-emulator smoke only", "true".equals(args.getString("runReminderDelivery")));
        Context app = InstrumentationRegistry.getInstrumentation().getTargetContext();
        ReminderScheduler scheduler = new ReminderScheduler(app);
        assertEquals("Grant POST_NOTIFICATIONS before this smoke", "granted", scheduler.permission());
        Calendar target = Calendar.getInstance();
        target.add(Calendar.MINUTE, 1);
        String time = String.format(Locale.ROOT, "%02d:%02d", target.get(Calendar.HOUR_OF_DAY), target.get(Calendar.MINUTE));
        String day = String.format(Locale.ROOT, "%04d-%02d-%02d", target.get(Calendar.YEAR), target.get(Calendar.MONTH) + 1, target.get(Calendar.DAY_OF_MONTH));
        JSONArray definitions = new JSONArray().put(new JSONObject().put("id", 99).put("medicationName", "PRIVATE-NATIVE-DELIVERY")
                .put("times", new JSONArray().put(time)).put("weekdays", new JSONArray().put(0).put(1).put(2).put(3).put(4).put(5).put(6))
                .put("startDate", day).put("endDate", JSONObject.NULL).put("enabled", true).put("discreet", true));
        try {
            assertEquals(1, scheduler.synchronize("https://reminder-smoke.example|999", definitions).getInt("scheduled"));
            JSONObject entry = new ReminderStore(app).read().getJSONArray("entries").getJSONObject(0);
            long occurrence = entry.getLong("next");
            int nativeId = entry.getInt("nativeId");
            StatusBarNotification delivered = null;
            long deadline = SystemClock.elapsedRealtime() + 180_000;
            NotificationManager manager = app.getSystemService(NotificationManager.class);
            while (SystemClock.elapsedRealtime() < deadline && delivered == null) {
                for (StatusBarNotification n : manager.getActiveNotifications())
                    if (ReminderScheduler.NOTIFICATION_TAG.equals(n.getTag()) && n.getId() == nativeId) delivered = n;
                if (delivered == null) SystemClock.sleep(500);
            }
            assertNotNull("No delivery observed in 180 seconds; inexact Android delivery may be delayed beyond this smoke window", delivered);
            assertFalse(delivered.getNotification().extras.getCharSequence(android.app.Notification.EXTRA_TEXT).toString().contains("PRIVATE-NATIVE-DELIVERY"));
            long next = new ReminderStore(app).read().getJSONArray("entries").getJSONObject(0).getLong("next");
            assertTrue("Receiver advances the recurrence after the delivered occurrence", next > occurrence);
            // Replaying the old alarm is ignored, rather than advancing the recurrence twice.
            IntentFixture.replay(scheduler, entry);
            assertEquals(next, new ReminderStore(app).read().getJSONArray("entries").getJSONObject(0).getLong("next"));
        } finally { scheduler.clear(); }
    }

    private static final class IntentFixture {
        static void replay(ReminderScheduler scheduler, JSONObject entry) throws Exception {
            Context app = InstrumentationRegistry.getInstrumentation().getTargetContext();
            scheduler.fire(new android.content.Intent(app, ReminderReceiver.class).setAction(ReminderScheduler.ALARM_ACTION)
                    .setData(android.net.Uri.parse("goreminder://alarm/" + entry.getInt("nativeId")))
                    .putExtra("reminderId", entry.getInt("id")).putExtra("token", entry.getString("token")).putExtra("at", entry.getLong("next")));
        }
    }
}
