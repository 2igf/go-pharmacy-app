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
public class CustomerCompletionJourneyTest {
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
        until("location.pathname+location.search===" + q(path) + "&&document.readyState==='complete'", "navigation");
    }
    private void input(String label, String value) throws Exception {
        until("(()=>{const l=[...document.querySelectorAll('label')].find(l=>l.textContent.trim()===" + q(label) + ");return !!(l?.querySelector('input,textarea')||document.getElementById(l?.htmlFor))})()", "form field ready");
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
        until("location.pathname+location.search==='/products'", "authenticated catalog");
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

    @Test public void profileAddressKnowledgeAndResponsiveCatalog() throws Exception {
        try {
            launch(); login(fixture.getJSONObject("users").getJSONObject("customer"));
            navigate("/profile"); text("ملفي الشخصي","profile");
            input("عنوان جديد","عنوان اختبار إكمال Android مبنى ١٢"); button("إضافة العنوان");
            text("عنوان اختبار إكمال Android","address added");button("تعديل العنوان");
            input("تعديل العنوان","عنوان اختبار إكمال معدل مبنى ٢٣");button("حفظ العنوان");
            text("عنوان اختبار إكمال معدل","address update saved");navigate("/products");navigate("/profile");
            text("عنوان اختبار إكمال معدل","address update persisted");report.put("addressEditReload",true);
            instrumentation.runOnMainSync(()->activity.getBridge().getWebView().getSettings().setUseWideViewPort(true));
            for(int width:new int[]{360,393,430}) {
                command("document.querySelector('meta[name=viewport]').content='width="+width+"'");
                until("Math.abs(innerWidth-"+width+")<=1","responsive viewport");
                assertEquals(Boolean.TRUE,js("document.documentElement.scrollWidth<=innerWidth+1"));
                report.put("profileViewport"+width,js("innerWidth"));screenshot("profile-"+width+".png");
            }
            command("document.querySelector('meta[name=viewport]').content='width=device-width, initial-scale=1'");
            navigate("/medicines");text("النطاق الدولي","default international scope");
            until("document.querySelectorAll('.medication-knowledge__results li').length===12","12 sourced records");
            screenshot("knowledge-list.png");
            command("document.querySelector('.medication-knowledge__results a').click()");text("المواد المرتبطة بالسجل من المصدر","ingredient detail");
            text("نسخة المصدر","source version detail");screenshot("knowledge-detail.png");report.put("knowledgeTwelveAndDetail",true);
            navigate("/products?search=DEMO%20Pagination&view=all");text("DEMO Pagination 01","catalog server search");
            button("التالي");text("DEMO Pagination 23","catalog next page");report.put("serverPaginationUi",true);
            navigate("/doctors");text("معاينة التصميم","doctors truthful preview");screenshot("doctors.png");
        } catch(Exception | AssertionError error) { if(activity!=null) screenshot("completion-ui-failure.png"); throw error; } finally {finish("completion-ui-report.json");}
    }
}

