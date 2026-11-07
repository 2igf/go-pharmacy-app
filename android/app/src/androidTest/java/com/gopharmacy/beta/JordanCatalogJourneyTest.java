package com.gopharmacy.beta;

import static org.junit.Assert.*;

import android.app.Instrumentation;
import android.content.Context;
import android.content.Intent;
import android.graphics.Bitmap;
import android.os.SystemClock;
import android.webkit.WebView;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import com.getcapacitor.BridgeActivity;
import java.io.File;
import java.io.FileOutputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.util.HashSet;
import java.util.Set;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;
import org.json.JSONArray;
import org.json.JSONObject;
import org.json.JSONTokener;
import org.junit.Test;
import org.junit.runner.RunWith;

/** Real bundled WebView and HTTPS backend; public historical facts, no clinical acceptance. */
@RunWith(AndroidJUnit4.class)
public class JordanCatalogJourneyTest {
    private final Instrumentation instrumentation = InstrumentationRegistry.getInstrumentation();
    private final Context app = instrumentation.getTargetContext();
    private final JSONObject report = new JSONObject();
    private BridgeActivity activity;
    private JSONObject fixture;
    private boolean isolated;

    private Object js(String expression) throws Exception {
        AtomicReference<String> result = new AtomicReference<>();
        CountDownLatch latch = new CountDownLatch(1);
        instrumentation.runOnMainSync(() -> activity.getBridge().getWebView().evaluateJavascript(expression, value -> {
            result.set(value);
            latch.countDown();
        }));
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

    private void command(String body) throws Exception {
        assertEquals("DOM action unavailable", Boolean.TRUE, js("(()=>{" + body + ";return true})()"));
    }

    private void text(String value, String stage) throws Exception {
        until("document.querySelector('main.medication-knowledge')?.innerText.includes(" + q(value) + ")===true", stage);
    }

    private void navigate(String path) throws Exception {
        command("location.assign(" + q(path) + ")");
        until("location.pathname+location.search===" + q(path) + "&&document.readyState==='complete'", "navigation");
    }

    private void input(String label, String value) throws Exception {
        until("(()=>{const l=[...document.querySelectorAll('label')].find(l=>l.textContent.trim()===" + q(label) + ");return !!(l?.querySelector('input,textarea')||document.getElementById(l?.htmlFor))})()", "form field ready");
        command("const l=[...document.querySelectorAll('label')].find(l=>l.textContent.trim()===" + q(label) + ");const e=l?.querySelector('input,textarea')||document.getElementById(l?.htmlFor);if(!e)throw Error('field');const p=e.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(p,'value').set.call(e," + q(value) + ");e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}))");
    }

    private void button(String label) throws Exception {
        until("[...document.querySelectorAll('button')].some(b=>b.textContent.trim()===" + q(label) + "&&!b.disabled)", "button available");
        command("[...document.querySelectorAll('button')].find(b=>b.textContent.trim()===" + q(label) + "&&!b.disabled).click()");
    }

    private void launch() throws Exception {
        org.junit.Assume.assumeTrue("Isolated checkoutTest fixture required", app.getPackageName().endsWith(".checkouttest"));
        isolated = true;
        fixture = new JSONObject(new String(Files.readAllBytes(new File(app.getFilesDir(), "checkout-fixture.json").toPath()), StandardCharsets.UTF_8));
        assertEquals("Only the isolated emulator HTTPS backend is allowed", "https://10.0.2.2:3451", fixture.getString("apiOrigin"));
        instrumentation.getUiAutomation().performGlobalAction(android.accessibilityservice.AccessibilityService.GLOBAL_ACTION_HOME);
        SystemClock.sleep(500);
        Intent launch = new Intent().setClassName(app.getPackageName(), "com.gopharmacy.beta.MainActivity").addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        activity = (BridgeActivity) instrumentation.startActivitySync(launch);
        until("document.readyState==='complete'&&!!document.body", "bundled document");
        until("document.hasFocus()", "Android WebView foreground focus");
        until("!!document.getElementById('api-origin')||!!document.querySelector('.customer-app')", "connection gate or connected app");
        if (Boolean.TRUE.equals(js("!!document.getElementById('api-origin')"))) {
            input("عنوان خادم HTTPS", fixture.getString("apiOrigin"));
            button("حفظ والاتصال");
            until("!document.getElementById('api-origin')&&!!document.querySelector('.customer-app')", "connection reload completed");
        }
        assertEquals("The app must use the isolated fixture backend", fixture.getString("apiOrigin"),
            js("document.querySelector('[data-native-connection-bar] p')?.textContent.trim()||''"));
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
        try (FileOutputStream output = new FileOutputStream(new File(app.getFilesDir(), name))) {
            assertTrue(bitmap.compress(Bitmap.CompressFormat.PNG, 100, output));
        } finally { bitmap.recycle(); }
    }

    private void finish() throws Exception {
        if (isolated) {
            try (FileOutputStream output = new FileOutputStream(new File(app.getFilesDir(), "jordan-catalog-ui-report.json"))) {
                output.write(report.toString(2).getBytes(StandardCharsets.UTF_8));
            }
        }
        if (activity != null) instrumentation.runOnMainSync(() -> activity.finish());
    }

    private String firstHref() throws Exception {
        return (String) js("document.querySelector('.medication-knowledge__results a')?.getAttribute('href')||''");
    }

    private void pageReady(int page, String previousHref) throws Exception {
        text("النتائج في الصفحة: 20 — الصفحة " + page + ".", "twenty historical packages on page " + page);
        until("document.querySelectorAll('.medication-knowledge__results > li').length===20", "historical page records");
        if (previousHref != null) {
            until("document.querySelector('.medication-knowledge__results a')?.getAttribute('href')!==" + q(previousHref), "next page differs");
        }
        assertTrue("Historical source warning missing", Boolean.TRUE.equals(js("[...document.querySelectorAll('.medication-knowledge__results > li')].every(e=>e.innerText.includes('التسجيل الحالي غير موثق')&&e.innerText.includes('المصدر:'))")));
        assertTrue("Repeated brand names require a distinct source package ID", Boolean.TRUE.equals(js("[...document.querySelectorAll('.medication-knowledge__results > li')].every(e=>/JO-MED-\\d{4}/.test(e.innerText))")));
    }

    private void collectPageIds(Set<String> ids) throws Exception {
        JSONArray current = (JSONArray) js("[...document.querySelectorAll('.medication-knowledge__results a')].map(a=>new URL(a.href).pathname.split('/').pop())");
        assertEquals("Each page contains twenty packages", 20, current.length());
        for (int index = 0; index < current.length(); index++) {
            String id = current.getString(index);
            assertTrue("A positive local record ID is required", id.matches("[1-9]\\d*"));
            assertTrue("Pagination repeated a package", ids.add(id));
        }
    }

    private void search(String value, String expectedBrand) throws Exception {
        navigate("/medicines?country=historical_jo");
        input("ابحث في البيانات المستوردة من المصادر", value);
        button("بحث في الدليل");
        until("new URLSearchParams(location.search).get('q')===" + q(value), "submitted search query");
        text(expectedBrand, "search finds historical package");
        until("document.querySelectorAll('.medication-knowledge__results > li').length>0", "search result cards");
    }

    private void fact(String label, String expected) throws Exception {
        assertEquals("Incorrect sourced fact: " + label, expected, js("(()=>{const dt=[...document.querySelectorAll('main.medication-knowledge dt')].find(e=>e.textContent.trim()===" + q(label) + ");return dt?.nextElementSibling?.textContent.trim()||''})()"));
    }

    private void assertInformationOnly() throws Exception {
        assertEquals("Historical data must not expose a purchase action", Boolean.TRUE,
            js("[...document.querySelectorAll('main.medication-knowledge button,main.medication-knowledge a')].every(e=>!/(أضف.*السلة|إضافة.*السلة|اشتر|شراء|checkout|add to cart|buy now)/i.test(e.textContent)&&!/^\\/(checkout|cart)(?:[/?#]|$)/.test(e.getAttribute('href')||''))"));
        assertEquals("Historical data must not display reviewed clinical text or verified registration", Boolean.TRUE,
            js("!document.querySelector('main.medication-knowledge .medication-knowledge__label,main.medication-knowledge .medication-knowledge__registration')"));
        assertEquals("Historical data must not display current prescription claims or monetary amounts", Boolean.TRUE,
            js("(()=>{const t=document.querySelector('main.medication-knowledge').innerText;return !/(بوصفة حسب المصدر|دون وصفة حسب المصدر|\\d[\\d,.]*\\s*(?:JOD|JD|د\\.أ)|(?:JOD|JD)\\s*\\d)/i.test(t)})()"));
    }

    /** Catches missing/duplicated imports, broken public search, and unsafe historical presentation. */
    @Test public void publicHistoricalCatalogPaginationSearchAndSourcedDetail() throws Exception {
        try {
            launch();
            JSONObject sample = fixture.optJSONObject("jordan");
            if (sample == null) sample = new JSONObject();
            String brand = sample.optString("brand", "Aricept");
            String generic = sample.optString("generic", "DONEPEZIL");
            String barcode = sample.optString("barcode", "4714534315122");
            String atc = sample.optString("atc", "N06DA02");
            String productId = sample.optString("productId", "JO-MED-0002");

            navigate("/medicines?country=historical_jo");
            text("كتالوج عبوات أردني تاريخي — قيد المراجعة", "historical scope");
            text("بيانات الأسعار تعود إلى 2021", "historical price warning");
            pageReady(1, null);
            assertEquals("Run with signed-out checkoutTest app state", Boolean.TRUE,
                js("[...document.querySelectorAll('.customer-app .canva-beta-notice a')].some(a=>a.getAttribute('href')==='/login')"));
            report.put("publicWithoutLogin", true);
            assertInformationOnly();
            screenshot("jordan-catalog-list.png");
            command("document.querySelector('.medication-knowledge__results').scrollIntoView({block:'start'})");
            screenshot("jordan-catalog-results.png");

            Set<String> ids = new HashSet<>();
            collectPageIds(ids);
            for (int page = 2; page <= 50; page++) {
                String previous = firstHref();
                button("التالي");
                until("new URLSearchParams(location.search).get('offset')===" + q(String.valueOf((page - 1) * 20)), "pagination URL");
                pageReady(page, previous);
                collectPageIds(ids);
            }
            assertEquals("All 1,000 distinct historical packages must be reachable", 1000, ids.size());
            report.put("allThousandDistinctPackagesReachable", true);
            report.put("twentyRowsOnLastPage", true);
            command("document.querySelector('.medication-knowledge__results').scrollIntoView({block:'start'})");
            screenshot("jordan-catalog-last-page.png");
            button("التالي");
            until("new URLSearchParams(location.search).get('offset')==='1000'", "end of imported catalog");
            text("النتائج في الصفحة: 0 — الصفحة 51.", "no rows beyond the thousand-package dataset");
            assertEquals(Boolean.TRUE, js("document.querySelectorAll('.medication-knowledge__results > li').length===0"));
            report.put("noPackagesBeyondThousand", true);

            search(brand.toUpperCase(java.util.Locale.ROOT), brand);
            report.put("brandSearch", true);
            search(generic, brand);
            report.put("genericSearch", true);
            search(atc, brand);
            report.put("atcSearch", true);
            search(barcode, brand);
            report.put("barcodeSearch", true);

            command("document.querySelector('.medication-knowledge__results a').click()");
            until("/^\\/medicines\\/[1-9]\\d*$/.test(location.pathname)", "historical package detail");
            text("العبوة التاريخية والمصدر وحالة المراجعة", "historical detail loaded");
            text(brand, "source brand");
            text(generic, "source generic");
            text("التسجيل الأردني الحالي: غير موثق", "current registration is unverified");
            text("المراجعة الطبية: لم تتم", "medical review missing");
            text("حقوق إعادة الاستخدام: قيد التحقق", "reuse pending");
            text("أسعار تاريخية من 2021؛ ليست أسعاراً حالية أو أسعار بيع.", "historical price boundary");
            text("النصوص الطبية مستبعدة من هذه الحزمة", "clinical content excluded");
            text("لا تتوفر نصوص طبية مراجعة بهذه اللغة", "no reviewed medical content");
            text("المصدر وحدود المراجعة", "source provenance");
            fact("معرّف مجموعة البيانات", "jordan_medicines_1000");
            fact("معرّف المنتج بالمجموعة", productId);
            fact("معرّف السجل بالمصدر", productId);
            fact("الباركود كما ورد بالمصدر", barcode);
            fact("رمز ATC بالمصدر", atc);
            fact("حالة الوصفة بالمصدر", "غير معروف");
            assertInformationOnly();
            report.put("sourcedPackageId", productId);
            report.put("localRecordId", (String) js("location.pathname.split('/').pop()"));
            report.put("historicalWarningsAndInformationOnly", true);
            screenshot("jordan-catalog-detail.png");
            command("[...document.querySelectorAll('main.medication-knowledge dt')].find(e=>e.textContent.trim()==='معرّف مجموعة البيانات').scrollIntoView({block:'start'})");
            screenshot("jordan-catalog-metadata.png");
            command("[...document.querySelectorAll('main.medication-knowledge dt')].find(e=>e.textContent.trim()==='تاريخ المصدر بالمجموعة').scrollIntoView({block:'start'})");
            screenshot("jordan-catalog-provenance.png");
            report.put("passed", true);
        } catch (Exception | AssertionError error) {
            report.put("passed", false);
            // Generic catalogue screens contain no fixture credentials or account details.
            try {
                if (activity != null && Boolean.TRUE.equals(js("!!document.querySelector('main.medication-knowledge')"))) screenshot("jordan-catalog-ui-failure.png");
            } catch (Exception | AssertionError ignored) { /* Preserve original failure. */ }
            throw error;
        } finally { finish(); }
    }
}
