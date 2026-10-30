package com.gopharmacy.beta;

import android.Manifest;
import android.content.Intent;
import android.os.Build;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import org.json.JSONArray;
import org.json.JSONObject;

@CapacitorPlugin(name = "GoReminders", permissions = {
    @Permission(alias = "notifications", strings = { Manifest.permission.POST_NOTIFICATIONS })
})
public class GoRemindersPlugin extends Plugin {
    private ReminderScheduler scheduler;

    @Override public void load() {
        scheduler = new ReminderScheduler(getContext());
        try { scheduler.restore(); } catch (Exception ignored) { /* Failed state is cleared by scheduler; no plaintext logging. */ }
    }

    private void resolve(PluginCall call, JSONObject result) throws Exception { call.resolve(new JSObject(result.toString())); }

    @PluginMethod public void synchronize(PluginCall call) {
        try {
            Object account = call.getData().opt("accountKey");
            JSONArray reminders = call.getData().optJSONArray("reminders");
            if (!(account instanceof String) || reminders == null) throw new IllegalArgumentException("An account key and reminders are required");
            resolve(call, scheduler.synchronize((String) account, reminders));
        } catch (IllegalArgumentException error) { call.reject(error.getMessage(), "INVALID_REMINDER"); }
        catch (Exception error) { call.reject("Local reminders could not be synchronized", "REMINDER_SYNC_FAILED"); }
    }

    @PluginMethod public void clear(PluginCall call) {
        try { scheduler.clear(); call.resolve(); }
        catch (Exception error) { call.reject("Local reminders could not be cleared", "REMINDER_CLEAR_FAILED"); }
    }

    @PluginMethod public void status(PluginCall call) {
        try { resolve(call, scheduler.status()); }
        catch (Exception error) { call.reject("Local reminder status is unavailable", "REMINDER_STATUS_FAILED"); }
    }

    @PluginMethod public void requestPermission(PluginCall call) {
        if (Build.VERSION.SDK_INT >= 33 && !"granted".equals(scheduler.permission())) {
            scheduler.markPermissionRequested();
            requestPermissionForAlias("notifications", call, "permissionResult");
        } else permissionResult(call);
    }

    @PermissionCallback private void permissionResult(PluginCall call) {
        try { scheduler.restore(); resolve(call, scheduler.status()); }
        catch (Exception error) { call.reject("Local reminder permission could not be checked", "REMINDER_PERMISSION_FAILED"); }
    }

    @PluginMethod public void consumeOpen(PluginCall call) {
        try { resolve(call, scheduler.consumeOpen()); }
        catch (Exception error) { call.reject("Reminder link is unavailable", "REMINDER_OPEN_FAILED"); }
    }

    @Override protected void handleOnNewIntent(Intent intent) {
        try {
            JSONObject event = scheduler.acceptOpen(intent);
            if (event != null && hasListeners("reminderOpened")) {
                scheduler.consumeOpen();
                notifyListeners("reminderOpened", new JSObject(event.toString()));
            }
        } catch (Exception ignored) { /* An invalid/stale notification must never bypass current-account checks. */ }
    }

    @Override protected void handleOnResume() {
        try { scheduler.restore(); } catch (Exception ignored) { /* User sees current status through the bridge. */ }
    }
}
