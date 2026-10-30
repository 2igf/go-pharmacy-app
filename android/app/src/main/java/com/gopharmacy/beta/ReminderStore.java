package com.gopharmacy.beta;

import android.content.Context;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.util.AtomicFile;
import org.json.JSONObject;
import java.io.File;
import java.io.FileOutputStream;
import java.nio.charset.StandardCharsets;
import java.security.KeyStore;
import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;

/** Atomic, authenticated ciphertext. Both data and AtomicFile backup live in Android's no-backup directory. */
final class ReminderStore {
    private static final String KEY_ALIAS = "go_reminders_v2";
    private static final byte[] AAD = "GO.Pharmacy.Reminders.v2".getBytes(StandardCharsets.UTF_8);
    private final AtomicFile file;

    ReminderStore(Context context) { file = new AtomicFile(new File(context.getNoBackupFilesDir(), "reminders-v2.enc")); }

    private SecretKey key() throws Exception {
        KeyStore store = KeyStore.getInstance("AndroidKeyStore");
        store.load(null);
        if (store.containsAlias(KEY_ALIAS)) return (SecretKey) store.getKey(KEY_ALIAS, null);
        KeyGenerator generator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore");
        generator.init(new KeyGenParameterSpec.Builder(KEY_ALIAS, KeyProperties.PURPOSE_ENCRYPT | KeyProperties.PURPOSE_DECRYPT)
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM).setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                .setRandomizedEncryptionRequired(true).setKeySize(256).build());
        return generator.generateKey();
    }

    JSONObject read() throws Exception {
        if (!file.getBaseFile().exists() && !new File(file.getBaseFile() + ".bak").exists()) return new JSONObject();
        byte[] data = file.readFully();
        if (data.length < 29 || data.length > 100_000 || data[0] != 1) throw new IllegalStateException("Invalid encrypted reminder state");
        Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
        cipher.init(Cipher.DECRYPT_MODE, key(), new GCMParameterSpec(128, data, 1, 12));
        cipher.updateAAD(AAD);
        return new JSONObject(new String(cipher.doFinal(data, 13, data.length - 13), StandardCharsets.UTF_8));
    }

    void write(JSONObject state) throws Exception {
        Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
        cipher.init(Cipher.ENCRYPT_MODE, key());
        cipher.updateAAD(AAD);
        byte[] encrypted = cipher.doFinal(state.toString().getBytes(StandardCharsets.UTF_8));
        FileOutputStream out = null;
        try {
            out = file.startWrite();
            out.write(1);
            out.write(cipher.getIV());
            out.write(encrypted);
            file.finishWrite(out);
        } catch (Exception error) {
            if (out != null) file.failWrite(out);
            throw error;
        }
    }

    void clear() { file.delete(); }
}
