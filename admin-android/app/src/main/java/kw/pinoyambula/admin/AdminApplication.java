package kw.pinoyambula.admin;

import android.app.Application;
import android.util.Log;

import com.google.firebase.FirebaseApp;
import com.google.firebase.FirebaseOptions;

public final class AdminApplication extends Application {
    @Override
    public void onCreate() {
        super.onCreate();
        String appId = BuildConfig.FIREBASE_APP_ID;
        String apiKey = BuildConfig.FIREBASE_API_KEY;
        String projectId = BuildConfig.FIREBASE_PROJECT_ID;
        String senderId = BuildConfig.FIREBASE_SENDER_ID;
        if (empty(appId) || empty(apiKey) || empty(projectId) || empty(senderId)) {
            Log.w("PinoyAdmin", "FCM configuration is not available in this build.");
            return;
        }
        try {
            if (FirebaseApp.getApps(this).isEmpty()) {
                FirebaseOptions options = new FirebaseOptions.Builder()
                    .setApplicationId(appId)
                    .setApiKey(apiKey)
                    .setProjectId(projectId)
                    .setGcmSenderId(senderId)
                    .build();
                FirebaseApp.initializeApp(this, options);
            }
        } catch (Exception error) {
            Log.e("PinoyAdmin", "Could not initialize Firebase in application process.", error);
        }
    }

    private boolean empty(String value) {
        return value == null || value.trim().isEmpty();
    }
}
