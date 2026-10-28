package com.gopharmacy.beta;

import static org.junit.Assert.*;
import android.app.Instrumentation;
import android.content.Context;
import android.content.Intent;
import android.graphics.Bitmap;
import android.os.SystemClock;
import android.webkit.WebView;
import android.view.accessibility.AccessibilityNodeInfo;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import com.getcapacitor.BridgeActivity;
import java.io.File;
import java.io.FileOutputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.net.URL;
import javax.net.ssl.HttpsURLConnection;
import javax.net.ssl.SSLException;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;
import org.json.JSONObject;
import org.json.JSONTokener;
import org.junit.Test;
import org.junit.runner.RunWith;

/** Real bundled React UI + WebView + CapacitorHttp + HTTPS + authenticated backend.
 * Only the separately identified checkoutTest variant may run this fixture.
 * No mocked transport, injected identity, devtools or certificate verifier override.
 */
@RunWith(AndroidJUnit4.class)
public class CheckoutJourneyTest {
    private final Instrumentation instrumentation = InstrumentationRegistry.getInstrumentation();
    private final Context app = instrumentation.getTargetContext();
    private BridgeActivity activity;
    private JSONObject fixture;
    private JSONObject report = new JSONObject();
    private Object js(String expression) throws Exception {
        AtomicReference<String> result = new AtomicReference<>();
        CountDownLatch latch = new CountDownLatch(1);
        instrumentation.runOnMainSync(() -> activity.getBridge().getWebView().evaluateJavascript(expression, value -> { result.set(value); latch.countDown(); }));
        assertTrue("WebView callback timeout", latch.await(15,TimeUnit.SECONDS));
        return new JSONTokener(result.get()==null?"null":result.get()).nextValue();
    }
    private void until(String condition,String stage) throws Exception {
        long deadline=SystemClock.elapsedRealtime()+45000;
        while(SystemClock.elapsedRealtime()<deadline){if(Boolean.TRUE.equals(js(condition)))return;SystemClock.sleep(150);}
        throw new AssertionError("WebView timeout at stage: "+stage);
    }
    private String q(String value){return JSONObject.quote(value);}
    private void command(String body) throws Exception {assertEquals("DOM action unavailable",Boolean.TRUE,js("(()=>{"+body+";return true})()"));}
    private void navigate(String path) throws Exception {command("location.assign("+q(path)+")");until("document.readyState==='complete'","document ready");}
    private void spaNavigate(String path) throws Exception {command("history.pushState(null,'',"+q(path)+");window.dispatchEvent(new PopStateEvent('popstate'))");}
    private void text(String text,String stage) throws Exception {until("document.body.innerText.includes("+q(text)+")",stage);}
    private void input(String label,String value) throws Exception {
        command("const l=[...document.querySelectorAll('label')].find(l=>l.textContent.trim()==="+q(label)+");const e=l?.querySelector('input')||document.getElementById(l?.htmlFor);if(!e)throw Error('field');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e,"+q(value)+");e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}))");
    }
    private void select(String label,String value) throws Exception {
        until("(()=>{const e=[...document.querySelectorAll('label')].find(l=>l.textContent.trim().startsWith("+q(label)+"))?.querySelector('select');return !!e&&[...e.options].some(o=>o.value==="+q(value)+")})()","loaded select: "+label);
        command("const e=[...document.querySelectorAll('label')].find(l=>l.textContent.trim().startsWith("+q(label)+"))?.querySelector('select');e.value="+q(value)+";e.dispatchEvent(new Event('change',{bubbles:true}))");
    }
    private void button(String label) throws Exception {
        until("[...document.querySelectorAll('button')].some(b=>b.textContent.trim()==="+q(label)+"&&!b.disabled)","button: "+label);
        command("[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==="+q(label)+"&&!b.disabled).click()");
    }
    private void login(String role) throws Exception {
        navigate("/login");text("البريد الإلكتروني","login form");JSONObject user=fixture.getJSONObject("users").getJSONObject(role);
        input("البريد الإلكتروني",user.getString("email"));input("كلمة المرور",user.getString("password"));button("دخول");until("location.pathname==='/products'","real login");text("الأدوية والمنتجات","catalog");
    }
    private void screenshot(String name) throws Exception {
        dismissSystemAnr();
        CountDownLatch frame=new CountDownLatch(1);
        instrumentation.runOnMainSync(()->activity.getBridge().getWebView().postVisualStateCallback(1,new WebView.VisualStateCallback(){@Override public void onComplete(long id){frame.countDown();}}));
        assertTrue("WebView visual frame timeout",frame.await(15,TimeUnit.SECONDS));
        CountDownLatch drawn=new CountDownLatch(1);
        instrumentation.runOnMainSync(()->{activity.getBridge().getWebView().invalidate();activity.getBridge().getWebView().postOnAnimation(()->activity.getBridge().getWebView().postOnAnimation(drawn::countDown));});
        assertTrue("Display frame timeout",drawn.await(10,TimeUnit.SECONDS));
        instrumentation.waitForIdleSync();
        SystemClock.sleep(750); // Let SurfaceFlinger commit the verified WebView frame.
        Bitmap bitmap=instrumentation.getUiAutomation().takeScreenshot();assertNotNull("Native screenshot unavailable",bitmap);
        try(FileOutputStream output=new FileOutputStream(new File(app.getFilesDir(),name))){bitmap.compress(Bitmap.CompressFormat.PNG,100,output);}bitmap.recycle();
    }
    private void dismissSystemAnr() {
        AccessibilityNodeInfo root=instrumentation.getUiAutomation().getRootInActiveWindow();
        if(root==null)return;
        if(root.findAccessibilityNodeInfosByText("System UI isn't responding").isEmpty())return;
        for(AccessibilityNodeInfo node:root.findAccessibilityNodeInfosByText("Wait")){AccessibilityNodeInfo target=node;while(target!=null&&!target.isClickable())target=target.getParent();if(target!=null){target.performAction(AccessibilityNodeInfo.ACTION_CLICK);return;}}
    }
    private void confirm() throws Exception {text("تأكيد إجراء تنفيذ تجريبي","review dialog");button("تأكيد العملية");}
    private void transition(String reason) throws Exception {input("سبب الإجراء",reason);button("مراجعة الإجراء");confirm();text("تم تسجيل الإجراء","transition committed");}

    @Test public void customerToPharmacyThroughBundledWebView() throws Exception {
        org.junit.Assume.assumeTrue("Isolated checkoutTest fixture required",app.getPackageName().endsWith(".checkouttest"));
        fixture=new JSONObject(new String(Files.readAllBytes(new File(app.getFilesDir(),"checkout-fixture.json").toPath()),StandardCharsets.UTF_8));
        String mode=InstrumentationRegistry.getArguments().getString("checkoutMode","journey");
        try {
            // Chain trusted by the scoped test CA; mismatched hostname must still fail.
            boolean rejected=false;try {HttpsURLConnection bad=(HttpsURLConnection)new URL("https://10.0.2.2:3444/healthz").openConnection();bad.setConnectTimeout(10000);bad.getInputStream().close();}catch(SSLException expected){rejected=true;}
            assertTrue("Hostname validation must remain enabled",rejected);report.put("wrongHostnameRejected",true);
            Intent launch=new Intent().setClassName(app.getPackageName(),"com.gopharmacy.beta.MainActivity").addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            activity=(BridgeActivity)instrumentation.startActivitySync(launch);
            dismissSystemAnr();
            until("document.readyState==='complete'&&!!document.body","bundled document");
            until("!!document.getElementById('api-origin')||document.body.innerText.includes('إعداد اتصال التطبيق')","connection gate");
            if(Boolean.TRUE.equals(js("!!document.getElementById('api-origin')"))){input("عنوان خادم HTTPS",fixture.getString("apiOrigin"));button("حفظ والاتصال");}
            login("customer");navigate("/profile");text("عنوان خيالي جديد","customer address form");
            if(Boolean.TRUE.equals(js("!document.body.innerText.includes('شارع اختبار Android الخيالي')"))){input("عنوان خيالي جديد","شارع اختبار Android الخيالي ١٢ — لا توصيل فعلي");button("إضافة العنوان");text("شارع اختبار Android الخيالي","address stored");}
            navigate("/cart");text("سلة التسوق التجريبية","cart loaded");
            until("document.body.innerText.includes('السلة فارغة')||document.body.innerText.includes("+q(fixture.getString("productName"))+")","cart data");
            if(Boolean.TRUE.equals(js("document.body.innerText.includes('السلة فارغة')"))){navigate("/product/"+fixture.getInt("productId"));text(fixture.getString("productName"),"fictional product");button("أضف إلى السلة");text("تم إضافة المنتج إلى السلة","cart committed");navigate("/cart");text(fixture.getString("productName"),"server cart");}
            button("متابعة الطلب التجريبي");text("اسم المستلم الخيالي","checkout form");
            if(Boolean.TRUE.equals(js("[...document.querySelectorAll('button')].some(b=>b.textContent.trim()==='إعادة المحاولة بأمان')"))){button("إعادة المحاولة بأمان");text("مراجعة السلة وتصحيح البيانات","saved rejected checkout");button("مراجعة السلة وتصحيح البيانات");}
            until("[...document.querySelectorAll('select option')].some(o=>o.textContent.includes('شارع اختبار Android الخيالي'))","owned address loaded");command("const s=document.querySelector('select');const o=[...s.options].find(o=>o.textContent.includes('شارع اختبار Android الخيالي'));if(!o)throw Error('address option');s.value=o.value;s.dispatchEvent(new Event('change',{bubbles:true}))");
            input("اسم المستلم الخيالي","عميل اختبار Android");
            if(!mode.equals("reproduce")){input("رقم اختبار","abc123456");command("[...document.querySelectorAll('input')].find(e=>e.parentElement.textContent.trim()==='رقم اختبار').reportValidity()");assertEquals(Boolean.TRUE,js("[...document.querySelectorAll('input')].find(e=>e.parentElement.textContent.trim()==='رقم اختبار').validationMessage.includes('رقم الاختبار')"));report.put("arabicFieldMessage",true);}
            input("رقم اختبار","٠٧٩ ١٢٣ ٤٥٦٧");command("document.querySelector('input[type=checkbox]').click()");
            report.put("phoneHtmlValidBeforeSubmit",js("[...document.querySelectorAll('input')].find(e=>e.parentElement.textContent.trim()==='رقم اختبار').checkValidity()"));
            button("تأكيد الطلب التجريبي");
            if(mode.equals("reproduce")){
                text("البيانات غير صالحة","original rejection");report.put("originalValidationReproduced",true);screenshot("checkout-before.png");return;
            }
            text("إعادة المحاولة بأمان","ambiguous checkout response");button("إعادة المحاولة بأمان");until("/^\\/order\\/[0-9]+$/.test(location.pathname)","checkout replay recovered order");
            int orderId=Integer.parseInt(String.valueOf(js("location.pathname.split('/').pop()")));report.put("orderId",orderId);report.put("checkoutResponseLossRecovered",true);text("طلب محاكاة محفوظ","customer receipt");
            login("admin");navigate("/admin/fulfillment");text("إدراج طلب تجريبي صريح","admin enrollment");select("الطلب التجريبي",String.valueOf(orderId));input("سبب الإدراج","إدراج رحلة Android الخيالية");button("مراجعة إدراج الطلب");confirm();button("اختيار صيدلية للطلب #"+orderId);text("الصيدلية المؤهلة","eligibility");select("الصيدلية المؤهلة",String.valueOf(fixture.getInt("organizationId")));input("سبب الإسناد","حجز مخزون تجربة Android");button("مراجعة الإسناد والحجز");confirm();text("أُسند للصيدلية","assignment committed");
            login("staff");navigate("/partners/pharmacy/orders?org="+fixture.getInt("organizationId"));button("عرض الطلب #"+orderId);text("تفاصيل الطلب التجريبي","assigned detail");transition("قبول طلب Android الخيالي");text("بدء التحضير","accepted");transition("بدء التحضير الخيالي Android");text("جاهز للتوصيل التجريبي","preparing");transition("جاهزية Android دون توصيل فعلي");text("جاهز لعقد التسليم المستقبلي","ready");report.put("pharmacyReady",true);screenshot("checkout-pharmacy-ready.png");
            login("customer");navigate("/order/"+orderId);text("جاهز للتوصيل التجريبي","customer sees fulfillment");report.put("customerSeesFulfillment",true);screenshot("checkout-customer-ready.png");
            // Same-document navigation retains the React Query cache across login.
            spaNavigate("/login");text("البريد الإلكتروني","SPA login");JSONObject admin=fixture.getJSONObject("users").getJSONObject("admin");input("البريد الإلكتروني",admin.getString("email"));input("كلمة المرور",admin.getString("password"));button("دخول");until("location.pathname==='/products'","SPA account switch");spaNavigate("/order/"+orderId);text("Record not found","server ownership rejection");assertEquals(Boolean.TRUE,js("!document.querySelector('article')&&!document.body.innerText.includes("+q(fixture.getString("productName"))+")"));report.put("cachedForeignOrderHidden",true);
        } finally {
            report.put("mode",mode);try(FileOutputStream output=new FileOutputStream(new File(app.getFilesDir(),"checkout-report.json"))){output.write(report.toString(2).getBytes(StandardCharsets.UTF_8));}
            if(activity!=null)instrumentation.runOnMainSync(()->activity.finish());
        }
    }
}
