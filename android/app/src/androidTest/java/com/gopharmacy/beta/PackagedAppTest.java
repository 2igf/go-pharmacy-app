package com.gopharmacy.beta;

import static org.junit.Assert.*;

import android.content.Context;
import android.content.pm.ApplicationInfo;
import android.security.NetworkSecurityPolicy;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import java.io.InputStream;
import java.io.ByteArrayOutputStream;
import java.nio.charset.StandardCharsets;
import org.json.JSONObject;
import org.junit.Test;
import org.junit.runner.RunWith;

/** Installed-artifact checks; does not claim external HTTPS/authentication coverage. */
@RunWith(AndroidJUnit4.class)
public class PackagedAppTest {
    private final Context app = InstrumentationRegistry.getInstrumentation().getTargetContext();

    private String asset(String path) throws Exception {
        try (InputStream stream = app.getAssets().open(path)) {
            ByteArrayOutputStream output = new ByteArrayOutputStream();
            byte[] buffer = new byte[4096];
            int count;
            while ((count = stream.read(buffer)) != -1) output.write(buffer, 0, count);
            return new String(output.toByteArray(), StandardCharsets.UTF_8);
        }
    }

    @Test
    public void packageAndNetworkPolicyAreConstrained() {
        assertEquals("com.gopharmacy.beta", app.getPackageName());
        assertEquals("GO Pharmacy", app.getApplicationInfo().loadLabel(app.getPackageManager()).toString());
        assertEquals(0, app.getApplicationInfo().flags & ApplicationInfo.FLAG_ALLOW_BACKUP);
        assertNotEquals(0, app.getApplicationInfo().flags & ApplicationInfo.FLAG_SUPPORTS_RTL);
        assertFalse(NetworkSecurityPolicy.getInstance().isCleartextTrafficPermitted());
    }

    @Test
    public void reactAssetsAreBundledWithoutRemoteNavigationOrNativeCookieLogging() throws Exception {
        String html = asset("public/index.html");
        assertTrue(html.contains("dir=\"rtl\""));
        assertTrue(html.contains("GO Pharmacy"));
        assertTrue(html.contains("Content-Security-Policy"));
        assertTrue(html.contains("/assets/"));
        JSONObject config = new JSONObject(asset("capacitor.config.json"));
        assertEquals("com.gopharmacy.beta", config.getString("appId"));
        assertEquals("none", config.getString("loggingBehavior"));
        assertFalse(config.getJSONObject("server").has("url"));
        assertFalse(config.getJSONObject("server").getBoolean("cleartext"));
        assertFalse(config.getJSONObject("android").getBoolean("allowMixedContent"));
    }
}
