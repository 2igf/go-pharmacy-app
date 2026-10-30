package com.gopharmacy.beta;

import static org.junit.Assert.*;
import static org.junit.Assume.assumeTrue;
import android.app.AlarmManager;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.os.SystemClock;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import java.util.Calendar;
import java.util.Locale;
import org.json.JSONArray;
import org.json.JSONObject;
import org.junit.After;
import org.junit.Before;
import org.junit.Test;
import org.junit.runner.RunWith;

/** State-based delayed-alarm regressions, NOT physical-phone delivery evidence.
 * Never replaces a real user's local plan; the test-only app id is mandatory. */
@RunWith(AndroidJUnit4.class)
public class ReminderResumeRegressionTest {
    private final Context app=InstrumentationRegistry.getInstrumentation().getTargetContext();
    private ReminderScheduler scheduler;
    private long fixtureDue;
    private final String account="https://notification-test.example|987";
    @Before public void setup() throws Exception {
        assumeTrue("Disposable diagnostic app only",app.getPackageName().equals("com.gopharmacy.beta.reminderdiagnostic"));
        scheduler=new ReminderScheduler(app);
        assertEquals("Diagnostic notification permission required","granted",scheduler.permission());
        Calendar past=Calendar.getInstance();past.add(Calendar.MINUTE,-2);past.set(Calendar.SECOND,0);past.set(Calendar.MILLISECOND,0);
        fixtureDue=past.getTimeInMillis(); // One immutable wall time per test, even across minute boundaries.
    }
    @After public void cleanup() throws Exception {if(scheduler!=null)scheduler.clear();}
    private JSONArray definitions() throws Exception {
        Calendar due=Calendar.getInstance();due.setTimeInMillis(fixtureDue);
        String time=String.format(Locale.ROOT,"%02d:%02d",due.get(Calendar.HOUR_OF_DAY),due.get(Calendar.MINUTE));
        return new JSONArray().put(new JSONObject().put("id",71).put("medicationName","Diagnostic fixture")
                .put("times",new JSONArray().put(time)).put("weekdays",new JSONArray().put(0).put(1).put(2).put(3).put(4).put(5).put(6))
                .put("startDate","2026-01-01").put("endDate",JSONObject.NULL).put("enabled",true).put("discreet",true));
    }
    private JSONObject entry() throws Exception {return new ReminderStore(app).read().getJSONArray("entries").getJSONObject(0);}
    /** Model an inexact occurrence already due but still waiting for Android.
     * The lock keeps the receiver from racing this controlled state assertion. */
    private long delayedPending() throws Exception {
        scheduler.synchronize(account,definitions());
        JSONObject state=new ReminderStore(app).read();JSONObject e=state.getJSONArray("entries").getJSONObject(0);
        long due=fixtureDue;e.put("next",due);new ReminderStore(app).write(state);
        app.getSystemService(AlarmManager.class).setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP,due,scheduler.alarmIntent(e,PendingIntent.FLAG_UPDATE_CURRENT));
        return due;
    }
    @Test public void resumeDoesNotDiscardOverdueRegisteredOccurrence() throws Exception {
        synchronized(ReminderScheduler.LOCK){long due=delayedPending();scheduler.restore();assertEquals("Resume must retain the outstanding occurrence instead of skipping it",due,entry().getLong("next"));}
    }
    @Test public void identicalSyncRetainsOccurrenceAndIntentIdentity() throws Exception {
        synchronized(ReminderScheduler.LOCK){long due=delayedPending();String nonce=entry().getString("token");scheduler.synchronize(account,definitions());assertEquals("Unchanged definition must retain the pending occurrence",due,entry().getLong("next"));assertTrue("Unchanged definition must retain its protected intent identity",nonce.equals(entry().getString("token")));}
    }
    @Test public void identicalSyncDoesNotDismissDeliveredNotification() throws Exception {
        scheduler.synchronize(account,definitions());JSONObject e=entry();int id=e.getInt("nativeId");
        NotificationManager manager=app.getSystemService(NotificationManager.class);manager.notify(ReminderScheduler.NOTIFICATION_TAG,id,scheduler.notification(e));
        long deadline=SystemClock.elapsedRealtime()+5000;boolean present=false;
        while(SystemClock.elapsedRealtime()<deadline&&!present){for(android.service.notification.StatusBarNotification n:manager.getActiveNotifications())if(ReminderScheduler.NOTIFICATION_TAG.equals(n.getTag())&&n.getId()==id)present=true;if(!present)SystemClock.sleep(50);}
        assertTrue("Actual diagnostic notification must be present before sync",present);
        scheduler.synchronize(account,definitions());present=false;for(android.service.notification.StatusBarNotification n:manager.getActiveNotifications())if(ReminderScheduler.NOTIFICATION_TAG.equals(n.getTag())&&n.getId()==id)present=true;
        assertTrue("Unchanged same-account sync must not dismiss an existing notification",present);
    }
    @Test public void addingAnotherReminderRetainsFirstPendingOccurrence() throws Exception {
        synchronized(ReminderScheduler.LOCK){
            long due=delayedPending();String nonce=entry().getString("token");
            JSONArray updated=definitions();updated.put(new JSONObject(updated.getJSONObject(0).toString()).put("id",72).put("times",new JSONArray().put("23:59")));
            scheduler.synchronize(account,updated);
            assertEquals("Editing the list must retain unchanged outstanding reminders",due,entry().getLong("next"));
            assertTrue("Unchanged entry keeps intent identity",nonce.equals(entry().getString("token")));
        }
    }
    @Test public void editedScheduleReplacesTheOldOccurrenceAndProtectedIdentity() throws Exception {
        synchronized(ReminderScheduler.LOCK){
            delayedPending();String nonce=entry().getString("token");Calendar later=Calendar.getInstance();later.add(Calendar.MINUTE,10);
            JSONArray edited=definitions();edited.getJSONObject(0).put("times",new JSONArray().put(String.format(Locale.ROOT,"%02d:%02d",later.get(Calendar.HOUR_OF_DAY),later.get(Calendar.MINUTE))));
            scheduler.synchronize(account,edited);
            assertTrue("Edited schedule replaces the stale intent",!nonce.equals(entry().getString("token")));
            assertTrue("Edited schedule uses the next future occurrence",entry().getLong("next")>System.currentTimeMillis());
        }
    }
    @Test public void explicitClockRestoreRecalculatesFutureWithoutCatchingUp() throws Exception {
        synchronized(ReminderScheduler.LOCK){
            delayedPending();scheduler.restore(true);
            assertTrue("Clock or boot reconciliation must not synthesize missed doses",entry().getLong("next")>System.currentTimeMillis());
        }
    }
}
