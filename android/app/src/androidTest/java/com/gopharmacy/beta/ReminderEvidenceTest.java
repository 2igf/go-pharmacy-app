package com.gopharmacy.beta;

import static org.junit.Assert.*;
import static org.junit.Assume.assumeTrue;
import android.accessibilityservice.AccessibilityService;
import android.app.Instrumentation;
import android.app.Notification;
import android.app.NotificationManager;
import android.content.Context;
import android.graphics.Bitmap;
import android.graphics.Rect;
import android.os.Bundle;
import android.os.SystemClock;
import android.service.notification.StatusBarNotification;
import android.view.InputDevice;
import android.view.MotionEvent;
import android.view.accessibility.AccessibilityNodeInfo;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import java.io.File;
import java.io.FileOutputStream;
import org.junit.Test;
import org.junit.runner.RunWith;

/** Opt-in actual Android-display capture. Never posts, simulates, or changes a reminder.
 * The resulting PNGs require a separate visual review. SystemUI text is not
 * consistently exposed through accessibility on this emulator; report that
 * probe independently instead of treating it as notification-delivery evidence.
 */
@RunWith(AndroidJUnit4.class)
public class ReminderEvidenceTest {
    private final Instrumentation instrumentation = InstrumentationRegistry.getInstrumentation();
    private final Context app = instrumentation.getTargetContext();

    private void screenshot(String name) throws Exception {
        SystemClock.sleep(1000);
        Bitmap bitmap = instrumentation.getUiAutomation().takeScreenshot();
        assertNotNull("Actual Android display screenshot unavailable", bitmap);
        try (FileOutputStream out = new FileOutputStream(new File(app.getFilesDir(), name))) {
            assertTrue("PNG encoding failed", bitmap.compress(Bitmap.CompressFormat.PNG, 100, out));
        } finally { bitmap.recycle(); }
    }
    private boolean visibleText(String text) {
        for (android.view.accessibility.AccessibilityWindowInfo window : instrumentation.getUiAutomation().getWindows()) {
            if (visibleText(window.getRoot(), text)) return true;
        }
        return visibleText(instrumentation.getUiAutomation().getRootInActiveWindow(), text);
    }
    private boolean visibleText(AccessibilityNodeInfo root, String text) {
        if (root == null) return false;
        for (AccessibilityNodeInfo node : root.findAccessibilityNodeInfosByText(text)) {
            Rect bounds = new Rect();
            node.getBoundsInScreen(bounds);
            if (node.isVisibleToUser() && !bounds.isEmpty()) return true;
        }
        return false;
    }
    private AccessibilityNodeInfo editable(AccessibilityNodeInfo root) {
        if (root == null) return null;
        if (root.isEditable() && root.isVisibleToUser()) return root;
        for (int i = 0; i < root.getChildCount(); i++) {
            AccessibilityNodeInfo result = editable(root.getChild(i));
            if (result != null) return result;
        }
        return null;
    }
    private void swipeUp() {
        int width = app.getResources().getDisplayMetrics().widthPixels;
        int height = app.getResources().getDisplayMetrics().heightPixels;
        // API36 rejected SDK MotionEvents with an implicit display. The official
        // test shell input tool explicitly targets the observed active display0.
        String command = "input -d 0 swipe " + width / 2 + " " + (int)(height * .92) + " " + width / 2 + " " + (int)(height * .20) + " 450";
        try (android.os.ParcelFileDescriptor descriptor = instrumentation.getUiAutomation().executeShellCommand(command);
             java.io.FileInputStream output = new java.io.FileInputStream(descriptor.getFileDescriptor())) {
            byte[] buffer = new byte[512];
            while (output.read(buffer) != -1) { /* Wait for the actual test input command to complete. */ }
        } catch (Exception error) { throw new AssertionError("Explicit-display launcher gesture failed", error); }
        SystemClock.sleep(1000);
    }

    @Test public void captureActualSystemNotificationAndLauncher() throws Exception {
        android.accessibilityservice.AccessibilityServiceInfo info = instrumentation.getUiAutomation().getServiceInfo();
        info.flags |= android.accessibilityservice.AccessibilityServiceInfo.FLAG_RETRIEVE_INTERACTIVE_WINDOWS;
        instrumentation.getUiAutomation().setServiceInfo(info);
        Bundle args = InstrumentationRegistry.getArguments();
        assumeTrue("Explicit dedicated-emulator evidence only", "true".equals(args.getString("runReminderEvidence")));
        String mode = args.getString("reminderEvidenceMode", "notification");
        assertTrue("Unknown evidence mode", mode.equals("notification") || mode.equals("launcher") || mode.equals("both"));
        if (mode.equals("notification") || mode.equals("both")) {
            boolean existingGenericNotification = false;
            for (StatusBarNotification n : app.getSystemService(NotificationManager.class).getActiveNotifications()) {
                if (!ReminderScheduler.NOTIFICATION_TAG.equals(n.getTag())) continue;
                CharSequence body = n.getNotification().extras.getCharSequence(Notification.EXTRA_TEXT);
                assertEquals("Capture permits only generic reminder content", ReminderDefinition.PUBLIC_BODY, body == null ? null : body.toString());
                existingGenericNotification = true;
            }
            assertTrue("A real, previously delivered generic reminder is required; this test never manufactures delivery", existingGenericNotification);
            assertTrue(instrumentation.getUiAutomation().performGlobalAction(AccessibilityService.GLOBAL_ACTION_NOTIFICATIONS));
            long deadline = SystemClock.elapsedRealtime() + 8000;
            while (SystemClock.elapsedRealtime() < deadline && !visibleText(ReminderDefinition.PUBLIC_BODY)) SystemClock.sleep(150);
            screenshot("v2-native-notification-drawer.png");
            Bundle probe = new Bundle();
            probe.putString("genericBodyAccessibilityExposed", Boolean.toString(visibleText(ReminderDefinition.PUBLIC_BODY)));
            instrumentation.sendStatus(0, probe);
            screenshot("v2-native-notification-drawer.png");
        }
        if (mode.equals("launcher") || mode.equals("both")) {
            assertTrue(instrumentation.getUiAutomation().performGlobalAction(AccessibilityService.GLOBAL_ACTION_HOME));
            SystemClock.sleep(1000);
            swipeUp();
            if (!visibleText("GO Pharmacy")) {
                AccessibilityNodeInfo search = editable(instrumentation.getUiAutomation().getRootInActiveWindow());
                if (search != null) {
                    Bundle text = new Bundle();
                    text.putCharSequence(AccessibilityNodeInfo.ACTION_ARGUMENT_SET_TEXT_CHARSEQUENCE, "GO Pharmacy");
                    assertTrue(search.performAction(AccessibilityNodeInfo.ACTION_SET_TEXT, text));
                    SystemClock.sleep(1000);
                }
            }
            assertEquals("GO Pharmacy", app.getApplicationInfo().loadLabel(app.getPackageManager()).toString());
            assertNotNull(app.getPackageManager().getLaunchIntentForPackage(app.getPackageName()));
            Bundle probe = new Bundle();
            probe.putString("launcherLabelAccessibilityExposed", Boolean.toString(visibleText("GO Pharmacy")));
            instrumentation.sendStatus(0, probe);
            screenshot("v2-native-launcher-icon.png");
        }
    }
}
