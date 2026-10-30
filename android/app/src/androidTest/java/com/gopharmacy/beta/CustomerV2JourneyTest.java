package com.gopharmacy.beta;

import static org.junit.Assert.*;
import android.app.Instrumentation;
import android.content.Context;
import android.content.Intent;
import android.graphics.Bitmap;
import android.os.SystemClock;
import android.view.accessibility.AccessibilityNodeInfo;
import android.webkit.WebView;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import com.getcapacitor.BridgeActivity;
import java.io.File;
import java.io.FileOutputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.util.Calendar;
import java.util.Locale;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;
import org.json.JSONObject;
import org.json.JSONTokener;
import org.junit.Test;
import org.junit.runner.RunWith;

/** Real bundled React forms and authenticated HTTPS backend. Isolated fictional checkoutTest data only. */
@RunWith(AndroidJUnit4.class)
public class CustomerV2JourneyTest {
    private final Instrumentation instrumentation = InstrumentationRegistry.getInstrumentation();
    private final Context app = instrumentation.getTargetContext();
    private BridgeActivity activity;
    private JSONObject fixture;
    private final JSONObject report = new JSONObject();

    private Object js(String expression) throws Exception {
        AtomicReference<String> result = new AtomicReference<>();
        CountDownLatch latch = new CountDownLatch(1);
        instrumentation.runOnMainSync(() -> activity.getBridge().getWebView().evaluateJavascript(expression, value -> { result.set(value); latch.countDown(); }));
        assertTrue("WebView callback timeout", latch.await(15, TimeUnit.SECONDS));
        return new JSONTokener(result.get() == null ? "null" : result.get()).nextValue();
    }
    private String q(String value) { return JSONObject.quote(value); }
    private void until(String condition, String stage) throws Exception {
        long deadline = SystemClock.elapsedRealtime() + 45000;
        while (SystemClock.elapsedRealtime() < deadline) {
            if (Boolean.TRUE.equals(js(condition))) return;
            SystemClock.sleep(150);
        }
        throw new AssertionError("WebView timeout at stage: " + stage);
    }
    private void command(String body) throws Exception { assertEquals("DOM action unavailable", Boolean.TRUE, js("(()=>{" + body + ";return true})()")); }
    private void text(String value, String stage) throws Exception { until("document.body.innerText.includes(" + q(value) + ")", stage); }
    private void navigate(String path) throws Exception {
        command("location.assign(" + q(path) + ")");
        until("location.pathname===" + q(path) + "&&document.readyState==='complete'", "navigation");
    }
    private void input(String label, String value) throws Exception {
        command("const l=[...document.querySelectorAll('label')].find(l=>l.textContent.trim()===" + q(label) + ");const e=l?.querySelector('input,textarea')||document.getElementById(l?.htmlFor);if(!e)throw Error('field');const p=e.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(p,'value').set.call(e," + q(value) + ");e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}))");
    }
    private void checkbox(String label, boolean checked) throws Exception {
        command("const l=[...document.querySelectorAll('label')].find(l=>l.textContent.trim()===" + q(label) + ");const e=l?.querySelector('input[type=checkbox]');if(!e)throw Error('checkbox');if(e.checked!==" + checked + ")e.click()");
    }
    private void button(String label) throws Exception {
        until("[...document.querySelectorAll('button')].some(b=>b.textContent.trim()===" + q(label) + "&&!b.disabled)", "button available");
        command("[...document.querySelectorAll('button')].find(b=>b.textContent.trim()===" + q(label) + "&&!b.disabled).click()");
    }
    private void link(String label) throws Exception {
        command("const e=[...document.querySelectorAll('a')].find(e=>e.textContent.trim()===" + q(label) + ");if(!e)throw Error('link');e.click()");
    }
    private void launch() throws Exception {
        org.junit.Assume.assumeTrue("Isolated checkoutTest fixture required", app.getPackageName().endsWith(".checkouttest"));
        fixture = new JSONObject(new String(Files.readAllBytes(new File(app.getFilesDir(), "checkout-fixture.json").toPath()), StandardCharsets.UTF_8));
        assertTrue("Fixture origin must remain HTTPS", fixture.getString("apiOrigin").startsWith("https://"));
        // A previous notification-drawer scenario must not cover the real app.
        instrumentation.getUiAutomation().performGlobalAction(android.accessibilityservice.AccessibilityService.GLOBAL_ACTION_HOME);
        SystemClock.sleep(500);
        Intent launch = new Intent().setClassName(app.getPackageName(), "com.gopharmacy.beta.MainActivity").addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        activity = (BridgeActivity) instrumentation.startActivitySync(launch);
        until("document.readyState==='complete'&&!!document.body", "bundled document");
        until("document.hasFocus()", "Android WebView foreground focus");
        until("!!document.getElementById('api-origin')||document.body.innerText.includes('إعداد اتصال التطبيق')", "connection gate");
        if (Boolean.TRUE.equals(js("!!document.getElementById('api-origin')"))) {
            input("عنوان خادم HTTPS", fixture.getString("apiOrigin"));
            button("حفظ والاتصال");
            until("!document.getElementById('api-origin')&&!!document.querySelector('.customer-app')", "connection reload completed");
        }
    }
    private void login(JSONObject user) throws Exception {
        navigate("/login");
        text("Welcome Back!", "customer login");
        input("البريد الإلكتروني", user.getString("email"));
        input("كلمة المرور", user.getString("password"));
        button("Log in");
        until("location.pathname==='/products'", "authenticated catalog");
        text("الأدوية والمنتجات", "server catalog");
    }
    private void screenshot(String name) throws Exception {
        CountDownLatch frame = new CountDownLatch(1);
        instrumentation.runOnMainSync(() -> activity.getBridge().getWebView().postVisualStateCallback(1, new WebView.VisualStateCallback() {
            @Override public void onComplete(long id) { frame.countDown(); }
        }));
        assertTrue("WebView visual frame timeout", frame.await(15, TimeUnit.SECONDS));
        instrumentation.waitForIdleSync();
        SystemClock.sleep(750);
        Bitmap bitmap = instrumentation.getUiAutomation().takeScreenshot();
        assertNotNull("Actual Android display unavailable", bitmap);
        try (FileOutputStream output = new FileOutputStream(new File(app.getFilesDir(), name))) { assertTrue(bitmap.compress(Bitmap.CompressFormat.PNG, 100, output)); }
        bitmap.recycle();
    }
    private void finish(String file) throws Exception {
        try (FileOutputStream output = new FileOutputStream(new File(app.getFilesDir(), file))) { output.write(report.toString(2).getBytes(StandardCharsets.UTF_8)); }
        if (activity != null) instrumentation.runOnMainSync(() -> activity.finish());
    }
    private String date(Calendar value) {
        return String.format(Locale.ROOT, "%04d-%02d-%02d", value.get(Calendar.YEAR), value.get(Calendar.MONTH) + 1, value.get(Calendar.DAY_OF_MONTH));
    }
    private void explicitNotificationPermission() throws Exception {
        if (!Boolean.TRUE.equals(js("document.body.innerText.includes('لم يُمنح بعد')"))) return;
        button("طلب إذن الإشعارات");
        long deadline = SystemClock.elapsedRealtime() + 10000;
        boolean allowed = false;
        while (SystemClock.elapsedRealtime() < deadline && !allowed) {
            AccessibilityNodeInfo root = instrumentation.getUiAutomation().getRootInActiveWindow();
            if (root != null) {
                allowed = clickNotificationAllow(root);
            }
            if (!allowed) SystemClock.sleep(150);
        }
        if (!allowed) screenshot("v2-permission-dialog.png");
        assertTrue("Explicit Android notification permission dialog was not accepted", allowed);
        text("الإذن متاح", "explicit notification grant reflected in UI");
        report.put("explicitNativePermissionAccepted", true);
    }
    private boolean clickNotificationAllow(AccessibilityNodeInfo node) {
        if (node == null) return false;
        String id = node.getViewIdResourceName();
        if (id != null && id.endsWith(":id/permission_allow_button") && node.isEnabled())
            return node.performAction(AccessibilityNodeInfo.ACTION_CLICK);
        for (int i = 0; i < node.getChildCount(); i++) if (clickNotificationAllow(node.getChild(i))) return true;
        return false;
    }

    @Test public void publicRegistrationAndTruthfulRecoveryThroughCustomerUi() throws Exception {
        try {
            launch();
            navigate("/login");
            text("Welcome Back!", "login page");
            command("document.querySelector('button[aria-label=\"إنشاء حساب عميل\"]').click()");
            text("Create your account", "public signup page");
            assertEquals(Boolean.TRUE, js("![...document.querySelectorAll('label')].some(e=>/دعوة|invite|role|دور/i.test(e.textContent))&&!document.querySelector('select[name=role],input[name=role],input[name=inviteCode]')"));
            screenshot("v2-public-signup.png");
            JSONObject publicUser = fixture.getJSONObject("users").optJSONObject("public");
            if (publicUser == null) publicUser = new JSONObject().put("email", "v2-ui-" + System.currentTimeMillis() + "@example.test")
                    .put("password", fixture.getJSONObject("users").getJSONObject("customer").getString("password")).put("name", "عميل تسجيل خيالي V2");
            input("الاسم / Name", publicUser.optString("name", "عميل تسجيل خيالي V2"));
            input("البريد الإلكتروني", publicUser.getString("email"));
            input("كلمة المرور", publicUser.getString("password"));
            input("تأكيد كلمة المرور / Confirm password", publicUser.getString("password"));
            command("document.querySelector('form button[type=submit]').click()");
            until("location.pathname==='/products'", "public registration authenticated");
            navigate("/reminders");
            text("إضافة تذكير", "publicly registered account has customer-only reminder access");
            report.put("publicSignupWithoutInvite", true).put("publicSignupCustomerBoundary", true);
            login(fixture.getJSONObject("users").getJSONObject("customer"));
            report.put("existingCustomerLogin", true);
            navigate("/login");
            button("Forgot your password?");
            until("location.pathname==='/forgot-password'", "recovery route");
            input("البريد الإلكتروني / Email", fixture.getJSONObject("users").getJSONObject("customer").getString("email"));
            button("طلب الاستعادة / Request recovery");
            until("document.body.innerText.includes('لم يُرسل بريد حقيقي')||document.body.innerText.includes('لم يُرسل بريد استعادة')", "truthful local/unavailable recovery response");
            assertEquals(Boolean.TRUE, js("!document.body.innerText.includes('recovery instructions will arrive')"));
            report.put("truthfulRecoveryDelivery", true).put("passwordResetUiExecuted", false);
            screenshot("v2-recovery-result.png");
        } finally { finish("v2-public-auth-report.json"); }
    }

    /** Token is injected only by the private, encrypted development mail-sink runner.
     * No token, password or recipient is emitted in evidence or screenshots. */
    @Test public void passwordRecoveryAndRecoveredLoginThroughCustomerUi() throws Exception {
        try {
            launch();
            JSONObject recovery = fixture.getJSONObject("users").getJSONObject("recovery");
            navigate("/reset-password");
            text("Reset your password", "reset form");
            input("رمز الاستعادة / Recovery code", recovery.getString("token"));
            input("كلمة المرور الجديدة / New password", recovery.getString("password"));
            input("تأكيد كلمة المرور / Confirm password", recovery.getString("password"));
            button("حفظ كلمة المرور / Save password");
            text("تم تغيير كلمة المرور", "password reset committed");
            screenshot("v2-recovery-complete.png");
            link("العودة للدخول / Back to login");
            login(recovery);
            report.put("passwordResetUiExecuted", true).put("recoveredPasswordLogin", true);
            navigate("/reset-password");
            input("رمز الاستعادة / Recovery code", recovery.getString("token"));
            input("كلمة المرور الجديدة / New password", recovery.getString("password"));
            input("تأكيد كلمة المرور / Confirm password", recovery.getString("password"));
            button("حفظ كلمة المرور / Save password");
            text("رمز الاستعادة غير صالح أو منتهي الصلاحية", "single-use token replay rejected");
            report.put("recoveryTokenReplayRejected", true).put("realEmailDelivery", false);
        } finally { finish("v2-recovery-ui-report.json"); }
    }

    @Test public void manualReminderCrudAndHistoryThroughRealCustomerUi() throws Exception {
        try {
            launch();
            login(fixture.getJSONObject("users").getJSONObject("customer"));
            navigate("/reminders");
            text("إضافة تذكير", "owned reminder list");
            explicitNotificationPermission();
            link("إضافة تذكير");
            text("إضافة تذكير يدوي", "new reminder form");
            input("اسم الدواء الذي تدخله يدوياً", "تذكير اختبار V2 الخيالي");
            input("نص الجرعة كما حدده المختص (اختياري)", "نص خيالي للاختبار فقط");
            input("ملاحظاتك (اختياري)", "بيانات خيالية — لا وصفة أو توصية علاجية");
            input("الوقت 1", "10:00");
            button("إضافة وقت آخر");
            input("الوقت 2", "20:00");
            checkbox("الجمعة", false);
            checkbox("السبت", false);
            Calendar day = Calendar.getInstance();
            input("تاريخ البداية", date(day));
            day.add(Calendar.DAY_OF_MONTH, 7);
            input("تاريخ النهاية (اختياري)", date(day));
            checkbox("التذكير مفعّل", true);
            checkbox("تنبيه خاص دون اسم الدواء على شاشة القفل", true);
            screenshot("v2-reminders-form.png");
            button("حفظ التذكير");
            until("/^\\/reminders\\/[1-9][0-9]*$/.test(location.pathname)", "server-created reminder detail");
            int id = Integer.parseInt(String.valueOf(js("location.pathname.split('/').pop()")));
            report.put("reminderId", id);
            navigate("/reminders/" + id); // A document reload proves the persisted server row is read again.
            text("تذكير اختبار V2 الخيالي", "persisted reminder name");
            text("10:00، 20:00", "persisted two daily times");
            text("لا توجد إفادات مسجلة.", "empty manual history after creation");
            assertEquals(Boolean.TRUE, js("document.querySelector('article').innerText.includes('الأحد، الاثنين، الثلاثاء، الأربعاء، الخميس')&&!document.querySelector('article').innerText.includes('الجمعة')&&!document.querySelector('article').innerText.includes('السبت')"));
            text("تنبيه خاص", "discreet persisted");
            report.put("realBackendCreateAndReload", true).put("twoTimesAndWeekdays", true).put("historyInitiallyEmpty", true);
            screenshot("v2-reminders-details.png");
            link("قائمة التذكيرات");
            text("تذكير اختبار V2 الخيالي", "list reads created row");
            screenshot("v2-reminders-list.png");
            navigate("/reminders/" + id);
            text("إيقاف مؤقت", "ready to pause");
            button("إيقاف مؤقت");
            text("تفعيل التذكير", "paused server row");
            button("تفعيل التذكير");
            text("إيقاف مؤقت", "resumed server row");
            report.put("pauseAndResume", true);
            link("تعديل");
            text("تعديل التذكير", "edit form");
            input("اسم الدواء الذي تدخله يدوياً", "تذكير اختبار V2 الخيالي المعدّل");
            input("الوقت 2", "21:00");
            button("حفظ التذكير");
            until("location.pathname===" + q("/reminders/" + id), "updated server detail");
            text("تذكير اختبار V2 الخيالي المعدّل", "updated name");
            text("10:00، 21:00", "updated second time");
            text("لا توجد إفادات مسجلة.", "editing never auto-recorded dose");
            report.put("editPersisted", true).put("noAutomaticDoseRecord", true);
            button("حذف التذكير");
            text("حذف التذكير وسجله؟", "explicit delete confirmation");
            button("إلغاء");
            text("تذكير اختبار V2 الخيالي المعدّل", "delete cancellation preserves reminder");
            button("حذف التذكير");
            text("حذف التذكير وسجله؟", "delete confirmation reopened");
            button("تأكيد الحذف");
            until("location.pathname==='/reminders'", "deleted and returned to list");
            until("!document.body.innerText.includes('تذكير اختبار V2 الخيالي')&&!document.body.innerText.includes('جار تحميل تذكيراتك')", "deleted row absent from refreshed server list");
            report.put("deleteCancelledThenConfirmed", true);
        } finally { finish("v2-reminders-ui-report.json"); }
    }
}
