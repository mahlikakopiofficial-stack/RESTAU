package kw.pinoyambula.admin;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.os.Build;

import com.google.firebase.messaging.FirebaseMessagingService;
import com.google.firebase.messaging.RemoteMessage;

import java.util.Map;

public final class AdminFirebaseMessagingService extends FirebaseMessagingService {
    private static final String CHANNEL_ID = "admin_events";

    @Override
    public void onNewToken(String token) {
        super.onNewToken(token);
        getSharedPreferences(AdminActivity.PREFS, MODE_PRIVATE)
            .edit().putString(AdminActivity.KEY_FCM_TOKEN, token).apply();
        AdminActivity.saveTokenAndNotify(token);
    }

    @Override
    public void onMessageReceived(RemoteMessage remoteMessage) {
        super.onMessageReceived(remoteMessage);
        Map<String, String> data = remoteMessage.getData();
        String title = remoteMessage.getNotification() != null
            ? remoteMessage.getNotification().getTitle() : null;
        String body = remoteMessage.getNotification() != null
            ? remoteMessage.getNotification().getBody() : null;

        if (title == null || title.trim().isEmpty()) {
            String type = data.getOrDefault("eventType", "event");
            title = "PinoyAmbula Admin: " + titleFor(type);
        }
        if (body == null || body.trim().isEmpty()) {
            body = "Open the admin app to review.";
        }
        showNotification(title, body, data);
    }

    private String titleFor(String type) {
        switch (type) {
            case "order": return "New order";
            case "inquiry": return "New customer inquiry";
            case "message": return "New customer message";
            case "subscription": return "New subscription";
            default: return "New event";
        }
    }

    private void showNotification(String title, String body, Map<String, String> data) {
        NotificationManager manager =
            (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (manager == null) return;

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                CHANNEL_ID,
                "Restaurant admin alerts",
                NotificationManager.IMPORTANCE_HIGH
            );
            channel.setDescription("New orders, inquiries, messages and subscriptions.");
            manager.createNotificationChannel(channel);
        }

        String route = data.getOrDefault("adminRoute", "Orders");
        String eventType = data.getOrDefault("eventType", "order");
        String recordId = data.getOrDefault("recordId", "");
        Intent intent = new Intent(this, AdminActivity.class)
            .setAction("kw.pinoyambula.admin.PUSH_CLICK")
            .putExtra("adminRoute", route)
            .putExtra("eventType", eventType)
            .putExtra("recordId", recordId)
            .addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);

        int requestCode = (eventType + ":" + recordId).hashCode();
        PendingIntent pendingIntent = PendingIntent.getActivity(
            this, requestCode, intent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        Notification.Builder builder = Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
            ? new Notification.Builder(this, CHANNEL_ID)
            : new Notification.Builder(this);
        builder.setSmallIcon(R.drawable.ic_stat_admin)
            .setContentTitle(title)
            .setContentText(body)
            .setContentIntent(pendingIntent)
            .setAutoCancel(true)
            .setCategory(Notification.CATEGORY_EVENT)
            .setPriority(Notification.PRIORITY_HIGH);

        manager.notify(requestCode, builder.build());
    }
}
