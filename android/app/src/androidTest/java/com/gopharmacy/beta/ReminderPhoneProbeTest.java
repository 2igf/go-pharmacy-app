package com.gopharmacy.beta;

import static org.junit.Assert.*;
import static org.junit.Assume.assumeTrue;
import android.content.Context;
import android.os.Bundle;
import android.os.SystemClock;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import java.io.File;
import java.io.FileOutputStream;
import java.nio.charset.StandardCharsets;
import org.json.JSONObject;
import org.junit.Test;
import org.junit.runner.RunWith;

/** Opt-in probe only. On a real phone use --no-restart and verify the process
 * stays unchanged. Never run the whole instrumentation suite on customer data. */
@RunWith(AndroidJUnit4.class)
public class ReminderPhoneProbeTest {
    @Test public void observeOrPostWithoutReplacingCustomerPlan() throws Exception {
        Bundle args=InstrumentationRegistry.getArguments();
        assumeTrue("Explicit authorized device probe only","true".equals(args.getString("runReminderProbe")));
        Context app=InstrumentationRegistry.getInstrumentation().getTargetContext();
        assertTrue("Only known GO Pharmacy packages",app.getPackageName().equals("com.gopharmacy.beta")||app.getPackageName().equals("com.gopharmacy.beta.reminderdiagnostic"));
        if(app.getPackageName().equals("com.gopharmacy.beta"))assertEquals("Phone probe requires explicit no-restart invocation","true",args.getString("reminderProbeNoRestart"));
        String phase=args.getString("reminderProbePhase","status");assertTrue("Unknown probe phase",phase.equals("status")||phase.equals("post"));
        String before=ReminderDiagnostics.planFingerprint(app);
        JSONObject report=ReminderDiagnostics.inspect(app).put("phase",phase);
        if(phase.equals("post")){
            assertTrue("Use Android's normal permission UI",report.getBoolean("postPermissionGranted"));
            try{
                ReminderDiagnostics.post(app);long until=SystemClock.elapsedRealtime()+5000;
                while(SystemClock.elapsedRealtime()<until&&!ReminderDiagnostics.active(app))SystemClock.sleep(50);
                report.put("testNotificationActiveInAndroid",ReminderDiagnostics.active(app)).put("visualPhoneDeliveryConfirmed",false);
                Bundle result=new Bundle();result.putString("reminderProbe",report.toString());InstrumentationRegistry.getInstrumentation().sendStatus(0,result);
                assertTrue("Android did not retain the diagnostic post",ReminderDiagnostics.active(app));
                SystemClock.sleep(20000);
            }finally{ReminderDiagnostics.cancelPost(app);}
        }
        boolean unchanged=before.equals(ReminderDiagnostics.planFingerprint(app));report.put("encryptedCustomerPlanUnchanged",unchanged);assertTrue("Plan changed during observation; correlate actual alarm activity before attributing it to the probe",unchanged);
        try(FileOutputStream file=new FileOutputStream(new File(app.getFilesDir(),"reminder-probe-safe.json"))){file.write(report.toString(2).getBytes(StandardCharsets.UTF_8));}
        Bundle result=new Bundle();result.putString("reminderProbe",report.toString());InstrumentationRegistry.getInstrumentation().sendStatus(0,result);
    }
}
