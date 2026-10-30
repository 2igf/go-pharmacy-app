package com.gopharmacy.beta;

import com.getcapacitor.BridgeActivity;
import android.os.Bundle;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        registerPlugin(GoRemindersPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
