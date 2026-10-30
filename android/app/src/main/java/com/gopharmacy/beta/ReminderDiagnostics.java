package com.gopharmacy.beta;

import android.Manifest;
import android.app.AlarmManager;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ApplicationInfo;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;
import java.io.File;
import java.io.FileInputStream;
import java.security.MessageDigest;
import java.security.KeyStore;
import java.util.TimeZone;
import org.json.JSONArray;
import org.json.JSONObject;

/** Public Java entry point for signed --no-restart instrumentation (a separate
 * classloader). Not a Capacitor method or exported Android component. Debug only;
 * never restores/replaces/deletes the customer plan or exposes clinical text. */
public final class ReminderDiagnostics {
    private static final String TAG="go_reminder_post_probe";
    private static final int ID=173101;
    private static void requireDebug(Context app){if((app.getApplicationInfo().flags&ApplicationInfo.FLAG_DEBUGGABLE)==0)throw new IllegalStateException("Diagnostics require a debug build");}
    public static JSONObject inspect(Context app) throws Exception {
        requireDebug(app);NotificationManager manager=app.getSystemService(NotificationManager.class);
        boolean postAllowed=Build.VERSION.SDK_INT<33||app.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS)==PackageManager.PERMISSION_GRANTED;
        JSONObject r=new JSONObject().put("deviceNowEpochMs",System.currentTimeMillis()).put("timezone",TimeZone.getDefault().getID())
                .put("androidApi",Build.VERSION.SDK_INT).put("manufacturer",Build.MANUFACTURER).put("model",Build.MODEL)
                .put("postPermissionGranted",postAllowed).put("globalNotificationsEnabled",NotificationManagerCompat.from(app).areNotificationsEnabled())
                .put("scheduleMode","inexact_setAndAllowWhileIdle");
        if(Build.VERSION.SDK_INT>=31)r.put("exactAlarmAccess",app.getSystemService(AlarmManager.class).canScheduleExactAlarms());
        if(Build.VERSION.SDK_INT>=26){NotificationChannel channel=manager.getNotificationChannel(ReminderScheduler.CHANNEL);r.put("channelExists",channel!=null);if(channel!=null)r.put("channelImportance",channel.getImportance());}
        try{synchronized(ReminderScheduler.LOCK){
            File base=new File(app.getNoBackupFilesDir(),"reminders-v2.enc");
            // Observe without AtomicFile recovery or creation of a missing key.
            if(new File(base+".bak").exists())throw new IllegalStateException("Recovery required");
            if(base.exists()){KeyStore keys=KeyStore.getInstance("AndroidKeyStore");keys.load(null);if(!keys.containsAlias("go_reminders_v2"))throw new IllegalStateException("Key unavailable");}
            JSONObject state=new ReminderStore(app).read();JSONArray entries=state.optJSONArray("entries"),safe=new JSONArray();
            if(entries!=null)for(int i=0;i<entries.length();i++){
                JSONObject e=entries.getJSONObject(i);int id=e.getInt("nativeId");
                Intent intent=new Intent(app,ReminderReceiver.class).setAction(ReminderScheduler.ALARM_ACTION).setData(Uri.parse("goreminder://alarm/"+id));
                safe.put(new JSONObject().put("reminderId",e.getInt("id")).put("nativeId",id).put("enabled",e.getBoolean("enabled"))
                        .put("nextEpochMs",e.optLong("next")).put("pendingIntentExists",PendingIntent.getBroadcast(app,id,intent,PendingIntent.FLAG_NO_CREATE|PendingIntent.FLAG_IMMUTABLE)!=null));
            }
            r.put("nativeEntries",safe).put("stateReadable",true);}
        }catch(Exception unavailable){r.put("stateReadable",false).put("stateError","LOCAL_STATE_UNAVAILABLE");}
        return r;
    }
    public static String planFingerprint(Context app) throws Exception {
        requireDebug(app);File file=new File(app.getNoBackupFilesDir(),"reminders-v2.enc");
        if(!file.exists())return "absent";
        MessageDigest digest=MessageDigest.getInstance("SHA-256");
        try(FileInputStream input=new FileInputStream(file)){byte[] buffer=new byte[4096];int count;while((count=input.read(buffer))!=-1)digest.update(buffer,0,count);}
        return java.util.Arrays.toString(digest.digest());
    }
    public static void post(Context app){
        requireDebug(app);NotificationManager manager=app.getSystemService(NotificationManager.class);
        if(Build.VERSION.SDK_INT>=26&&manager.getNotificationChannel(ReminderScheduler.CHANNEL)==null)throw new IllegalStateException("Production channel is missing");
        manager.notify(TAG,ID,new NotificationCompat.Builder(app,ReminderScheduler.CHANNEL).setSmallIcon(android.R.drawable.ic_popup_reminder)
                .setContentTitle("GO Pharmacy").setContentText("اختبار إشعار محلي — لا يحتوي معلومات دوائية")
                .setVisibility(NotificationCompat.VISIBILITY_PRIVATE).setAutoCancel(true).build());
    }
    public static boolean active(Context app){requireDebug(app);for(android.service.notification.StatusBarNotification n:app.getSystemService(NotificationManager.class).getActiveNotifications())if(TAG.equals(n.getTag())&&n.getId()==ID)return true;return false;}
    public static void cancelPost(Context app){requireDebug(app);app.getSystemService(NotificationManager.class).cancel(TAG,ID);}
    static void trace(Context app,String event,int id,long at){
        if((app.getApplicationInfo().flags&ApplicationInfo.FLAG_DEBUGGABLE)!=0)
            android.util.Log.i("GoReminders","event="+event+" reminderId="+id+" epochMs="+at);
    }
}
