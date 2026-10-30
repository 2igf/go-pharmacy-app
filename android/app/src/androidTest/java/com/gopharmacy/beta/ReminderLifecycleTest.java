package com.gopharmacy.beta;

import static org.junit.Assert.*;
import static org.junit.Assume.assumeTrue;
import android.app.NotificationManager;
import android.content.Context;
import android.os.Bundle;
import android.service.notification.StatusBarNotification;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import java.util.Calendar;
import java.util.Locale;
import java.util.TimeZone;
import org.json.JSONArray;
import org.json.JSONObject;
import org.junit.Test;
import org.junit.runner.RunWith;

/** Opt-in prepare/inspect/clear fixture for an external adb close or reboot scenario. */
@RunWith(AndroidJUnit4.class)
public class ReminderLifecycleTest {
    @Test public void controlledExternalLifecycleScenario() throws Exception {
        Bundle args = InstrumentationRegistry.getArguments();
        assumeTrue("Explicit dedicated-emulator fixture only", "true".equals(args.getString("runReminderLifecycle")));
        Context app = InstrumentationRegistry.getInstrumentation().getTargetContext();
        ReminderScheduler scheduler = new ReminderScheduler(app);
        String action = args.getString("reminderFixtureAction", "inspect");
        if ("clear".equals(action)) { scheduler.clear(); return; }
        if ("prepare".equals(action)) {
            assertEquals("Grant notifications before preparing a lifecycle fixture", "granted", scheduler.permission());
            int delay = Integer.parseInt(args.getString("reminderFixtureDelayMinutes", "2"));
            assertTrue(delay >= 1 && delay <= 10);
            Calendar target = Calendar.getInstance();
            target.add(Calendar.MINUTE, delay);
            String time = String.format(Locale.ROOT, "%02d:%02d", target.get(Calendar.HOUR_OF_DAY), target.get(Calendar.MINUTE));
            String day = String.format(Locale.ROOT, "%04d-%02d-%02d", target.get(Calendar.YEAR), target.get(Calendar.MONTH) + 1, target.get(Calendar.DAY_OF_MONTH));
            JSONArray defs = new JSONArray().put(new JSONObject().put("id", 98).put("medicationName", "PRIVATE-NATIVE-LIFECYCLE")
                    .put("times", new JSONArray().put(time)).put("weekdays", new JSONArray().put(0).put(1).put(2).put(3).put(4).put(5).put(6))
                    .put("startDate", day).put("endDate", JSONObject.NULL).put("enabled", true).put("discreet", true));
            assertEquals(1, scheduler.synchronize(args.getString("reminderFixtureAccount", "https://reminder-smoke.example|999"), defs).getInt("scheduled"));
            JSONObject entry = new ReminderStore(app).read().getJSONArray("entries").getJSONObject(0);
            Bundle result = new Bundle();
            result.putString("reminderFixtureScheduledAt", Long.toString(entry.getLong("next")));
            result.putString("reminderFixtureTimezone", TimeZone.getDefault().getID());
            result.putString("reminderFixtureNativeId", Integer.toString(entry.getInt("nativeId")));
            InstrumentationRegistry.getInstrumentation().sendStatus(0, result);
            return; // Intentionally retain the fixture while the external runner closes/reboots Android.
        }
        assertEquals("Unknown lifecycle fixture action", "inspect", action);
        JSONObject entry = new ReminderStore(app).read().getJSONArray("entries").getJSONObject(0);
        StatusBarNotification delivered = null;
        for (StatusBarNotification n : app.getSystemService(NotificationManager.class).getActiveNotifications())
            if (ReminderScheduler.NOTIFICATION_TAG.equals(n.getTag()) && n.getId() == entry.getInt("nativeId")) delivered = n;
        assertNotNull("No delivered fixture notification is currently visible", delivered);
        assertFalse(delivered.getNotification().extras.getCharSequence(android.app.Notification.EXTRA_TEXT).toString().contains("PRIVATE-NATIVE-LIFECYCLE"));
        assertTrue("Receiver persisted the next future occurrence", entry.getLong("next") > System.currentTimeMillis());
    }
}
