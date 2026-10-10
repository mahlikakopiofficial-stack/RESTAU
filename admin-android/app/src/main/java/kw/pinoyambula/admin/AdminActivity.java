package kw.pinoyambula.admin;

import android.Manifest;
import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.view.ViewGroup;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

import androidx.annotation.Nullable;

import com.google.firebase.FirebaseApp;
import com.google.firebase.FirebaseOptions;
import com.google.firebase.messaging.FirebaseMessaging;

import org.json.JSONObject;

public final class AdminActivity extends Activity {
    private static final String ADMIN_URL = "https://admin-pinoy-ambula.duckdns.org/admin.html";
    static final String PREFS = "pinoyambula_admin";
    static final String KEY_FCM_TOKEN = "admin_fcm_token";
    private static volatile AdminActivity activeActivity;

    private WebView webView;
    private ValueCallback<Uri[]> uploadCallback;
    private boolean pageReady = false;
    private String pendingRoute = "";
    private String pendingEventType = "";
    private String pendingRecordId = "";

    @Override
    protected void onCreate(@Nullable Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().setStatusBarColor(Color.rgb(123, 45, 38));
        getWindow().setNavigationBarColor(Color.rgb(41, 37, 36));

        webView = new WebView(this);
        webView.setLayoutParams(new ViewGroup.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT,
            ViewGroup.LayoutParams.MATCH_PARENT
        ));
        setContentView(webView);

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(true);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setJavaScriptCanOpenWindowsAutomatically(false);
        webView.addJavascriptInterface(new AdminPushBridge(), "NativeAdminPush");

        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback,
                    FileChooserParams params) {
                if (uploadCallback != null) uploadCallback.onReceiveValue(null);
                uploadCallback = callback;
                try {
                    startActivityForResult(params.createIntent(), 3114);
                    return true;
                } catch (ActivityNotFoundException error) {
                    uploadCallback = null;
                    Toast.makeText(AdminActivity.this, "No file picker is available.", Toast.LENGTH_SHORT).show();
                    return false;
                }
            }
        });

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                return handleNavigation(request.getUrl());
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, String url) {
                return handleNavigation(Uri.parse(url));
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                super.onPageFinished(view, url);
                if (isAdminUrl(Uri.parse(url))) {
                    pageReady = true;
                    String token = getSharedPreferences(PREFS, MODE_PRIVATE).getString(KEY_FCM_TOKEN, "");
                    if (!token.isEmpty()) emitFcmToken(token);
                    dispatchPendingNotification();
                }
            }
        });

        initializeFirebase();
        requestNotificationPermission();
        handleNotificationIntent(getIntent());
        webView.loadUrl(ADMIN_URL);
    }

    private boolean handleNavigation(Uri uri) {
        if (isAdminUrl(uri)) return false;

        // The app's native bridge is only exposed to the trusted admin origin.
        // Public-site and third-party links open outside this admin-only WebView.
        try {
            if ("https".equalsIgnoreCase(uri.getScheme())) {
                startActivity(new Intent(Intent.ACTION_VIEW, uri));
            }
        } catch (ActivityNotFoundException ignored) {}
        return true;
    }

    private boolean isAdminUrl(Uri uri) {
        return uri != null
            && "https".equalsIgnoreCase(uri.getScheme())
            && "admin-pinoy-ambula.duckdns.org".equalsIgnoreCase(uri.getHost());
    }

    private void initializeFirebase() {
        String appId = BuildConfig.FIREBASE_APP_ID;
        String apiKey = BuildConfig.FIREBASE_API_KEY;
        String projectId = BuildConfig.FIREBASE_PROJECT_ID;
        String senderId = BuildConfig.FIREBASE_SENDER_ID;
        if (empty(appId) || empty(apiKey) || empty(projectId) || empty(senderId)) {
            Toast.makeText(this,
                "Admin push is not configured in this build yet.",
                Toast.LENGTH_LONG).show();
            return;
        }

        try {
            FirebaseApp firebaseApp;
            if (FirebaseApp.getApps(this).isEmpty()) {
                FirebaseOptions options = new FirebaseOptions.Builder()
                    .setApplicationId(appId)
                    .setApiKey(apiKey)
                    .setProjectId(projectId)
                    .setGcmSenderId(senderId)
                    .build();
                firebaseApp = FirebaseApp.initializeApp(this, options);
            } else {
                firebaseApp = FirebaseApp.getInstance();
            }

            if (firebaseApp == null) {
                Toast.makeText(this, "Could not initialize Firebase for admin push.", Toast.LENGTH_LONG).show();
                return;
            }

            FirebaseMessaging.getInstance(firebaseApp).getToken()
                .addOnSuccessListener(this::storeAndEmit)
                .addOnFailureListener(error ->
                    android.util.Log.w("PinoyAdmin", "Could not retrieve FCM token."));
        } catch (Exception error) {
            android.util.Log.e("PinoyAdmin", "Firebase initialization failed.", error);
            Toast.makeText(this, "Admin push setup is incomplete.", Toast.LENGTH_LONG).show();
        }
    }

    private boolean empty(String value) {
        return value == null || value.trim().isEmpty();
    }

    private void requestNotificationPermission() {
        if (Build.VERSION.SDK_INT >= 33 &&
            checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
            requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS}, 3115);
        }
    }

    static void saveTokenAndNotify(String token) {
        AdminActivity activity = activeActivity;
        if (activity != null) activity.runOnUiThread(() -> activity.storeAndEmit(token));
    }

    private void storeAndEmit(String token) {
        if (token == null || token.trim().isEmpty()) return;
        getSharedPreferences(PREFS, MODE_PRIVATE).edit().putString(KEY_FCM_TOKEN, token).apply();
        emitFcmToken(token);
    }

    private void emitFcmToken(String token) {
        if (webView == null || token == null || token.isEmpty()) return;
        String js = "window.dispatchEvent(new CustomEvent('admin-fcm-token',{detail:{token:"
            + JSONObject.quote(token) + "}}));";
        webView.evaluateJavascript(js, null);
    }

    private void handleNotificationIntent(Intent intent) {
        if (intent == null) return;
        pendingRoute = String.valueOf(intent.getStringExtra("adminRoute") == null ? "" : intent.getStringExtra("adminRoute"));
        pendingEventType = String.valueOf(intent.getStringExtra("eventType") == null ? "" : intent.getStringExtra("eventType"));
        pendingRecordId = String.valueOf(intent.getStringExtra("recordId") == null ? "" : intent.getStringExtra("recordId"));
        dispatchPendingNotification();
    }

    private void dispatchPendingNotification() {
        if (!pageReady || webView == null || pendingRoute.isEmpty()) return;
        String js = "window.dispatchEvent(new CustomEvent('admin-push-open',{detail:{adminRoute:"
            + JSONObject.quote(pendingRoute) + ",eventType:"
            + JSONObject.quote(pendingEventType) + ",recordId:"
            + JSONObject.quote(pendingRecordId) + "}}));";
        webView.evaluateJavascript(js, null);
        pendingRoute = "";
        pendingEventType = "";
        pendingRecordId = "";
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        handleNotificationIntent(intent);
    }

    @Override
    protected void onResume() {
        super.onResume();
        activeActivity = this;
        String token = getSharedPreferences(PREFS, MODE_PRIVATE).getString(KEY_FCM_TOKEN, "");
        if (pageReady && !token.isEmpty()) emitFcmToken(token);
    }

    @Override
    protected void onPause() {
        if (activeActivity == this) activeActivity = null;
        super.onPause();
    }

    @Override
    protected void onDestroy() {
        if (uploadCallback != null) {
            uploadCallback.onReceiveValue(null);
            uploadCallback = null;
        }
        if (activeActivity == this) activeActivity = null;
        if (webView != null) {
            webView.removeJavascriptInterface("NativeAdminPush");
            webView.destroy();
            webView = null;
        }
        super.onDestroy();
    }

    @Override
    @SuppressWarnings("deprecation")
    protected void onActivityResult(int requestCode, int resultCode, @Nullable Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode == 3114 && uploadCallback != null) {
            Uri[] result = WebChromeClient.FileChooserParams.parseResult(resultCode, data);
            uploadCallback.onReceiveValue(result);
            uploadCallback = null;
        }
    }

    @Override
    public void onBackPressed() {
        if (webView != null && webView.canGoBack()) webView.goBack();
        else super.onBackPressed();
    }

    public final class AdminPushBridge {
        @JavascriptInterface
        public String getFcmToken() {
            return getSharedPreferences(PREFS, MODE_PRIVATE).getString(KEY_FCM_TOKEN, "");
        }

        @JavascriptInterface
        public void refreshFcmToken() {
            runOnUiThread(() -> {
                try {
                    FirebaseMessaging.getInstance().getToken()
                        .addOnSuccessListener(AdminActivity.this::storeAndEmit)
                        .addOnFailureListener(error ->
                            android.util.Log.w("PinoyAdmin", "FCM token refresh failed."));
                } catch (Exception ignored) {}
            });
        }
    }
}
