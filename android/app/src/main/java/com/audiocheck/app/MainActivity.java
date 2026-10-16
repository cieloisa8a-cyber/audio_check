package com.audiocheck.app;

import android.app.Activity;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.ContentValues;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.pm.PackageManager;
import android.content.res.AssetManager;
import android.media.AudioDeviceCallback;
import android.media.AudioDeviceInfo;
import android.media.AudioManager;
import android.graphics.Canvas;
import android.graphics.Paint;
import android.graphics.Typeface;
import android.graphics.pdf.PdfDocument;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.os.Handler;
import android.os.Looper;
import android.provider.MediaStore;
import android.util.Log;
import android.view.KeyEvent;
import android.view.View;
import android.view.WindowInsets;
import android.net.http.SslError;
import android.webkit.ConsoleMessage;
import android.webkit.JavascriptInterface;
import android.webkit.SslErrorHandler;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileNotFoundException;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.text.Normalizer;
import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Date;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

public final class MainActivity extends Activity {
    private static final String APP_HOST = "appassets.androidplatform.net";
    private static final String APP_URL = "https://" + APP_HOST + "/";
    private static final int INK = 0xff142b2a;
    private static final int MUTED = 0xff526260;
    private static final int GRID = 0xffd5dfdb;
    private static final int LEFT = 0xffdc684c;
    private static final int RIGHT = 0xff237e72;
    private static final int[] FREQUENCIES = {250, 500, 1000, 2000, 4000, 8000};
    private static final int MAX_MEASUREMENTS = FREQUENCIES.length * 2;

    private final Handler mainHandler = new Handler(Looper.getMainLooper());
    private WebView webView;
    private AudioManager audioManager;
    private AudioDeviceCallback audioDeviceCallback;
    private BroadcastReceiver headsetReceiver;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        audioManager = (AudioManager) getSystemService(AUDIO_SERVICE);
        isVolumeLocked = false;
        webView = new WebView(this);
        webView.setBackgroundColor(0xfff3f5ef);
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setAllowFileAccess(true);
        settings.setAllowContentAccess(true);
        settings.setSupportMultipleWindows(false);
        WebView.setWebContentsDebuggingEnabled(true);
        webView.addJavascriptInterface(new AndroidBridge(this), "AndroidApp");
        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onConsoleMessage(ConsoleMessage consoleMessage) {
                Log.d("AudioCheckJS", consoleMessage.message() + " ["
                        + consoleMessage.sourceId() + ":" + consoleMessage.lineNumber() + "]");
                return true;
            }
        });
        webView.setWebViewClient(new LocalAppClient());
        audioDeviceCallback = new AudioDeviceCallback() {
            @Override
            public void onAudioDevicesAdded(AudioDeviceInfo[] addedDevices) {
                updateWebHeadphoneStatus();
            }

            @Override
            public void onAudioDevicesRemoved(AudioDeviceInfo[] removedDevices) {
                updateWebHeadphoneStatus();
            }
        };
        audioManager.registerAudioDeviceCallback(audioDeviceCallback, mainHandler);
        headsetReceiver = new BroadcastReceiver() {
            @Override
            public void onReceive(Context context, Intent intent) {
                if (Intent.ACTION_HEADSET_PLUG.equals(intent.getAction())) {
                    updateWebHeadphoneStatus();
                }
            }
        };
        IntentFilter filter = new IntentFilter(Intent.ACTION_HEADSET_PLUG);
        if (Build.VERSION.SDK_INT >= 33) {
            registerReceiver(headsetReceiver, filter, Context.RECEIVER_EXPORTED);
            if (checkSelfPermission("android.permission.POST_NOTIFICATIONS") != PackageManager.PERMISSION_GRANTED) {
                requestPermissions(new String[]{"android.permission.POST_NOTIFICATIONS"}, 101);
            }
        } else {
            registerReceiver(headsetReceiver, filter);
        }

        if (Build.VERSION.SDK_INT >= 35) {
            getWindow().getDecorView().setSystemUiVisibility(
                    View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR | View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR
            );
            webView.setOnApplyWindowInsetsListener((view, insets) -> {
                android.graphics.Insets systemBars = insets.getInsets(WindowInsets.Type.systemBars());
                view.setPadding(
                        systemBars.left,
                        systemBars.top,
                        systemBars.right,
                        systemBars.bottom
                );
                return insets;
            });
        }
        setContentView(webView);
        if (Build.VERSION.SDK_INT >= 35) {
            webView.requestApplyInsets();
        }
        webView.loadUrl(APP_URL);
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (isVolumeLocked) {
            lockVolumeTo50Percent();
        }
        updateWebHeadphoneStatus();
    }

    @Override
    protected void onDestroy() {
        if (audioManager != null && audioDeviceCallback != null) {
            audioManager.unregisterAudioDeviceCallback(audioDeviceCallback);
        }
        if (headsetReceiver != null) {
            try {
                unregisterReceiver(headsetReceiver);
            } catch (Exception ignored) {
            }
        }
        super.onDestroy();
    }

    private boolean areWiredHeadphonesConnected() {
        if (audioManager == null) return false;
        for (AudioDeviceInfo device : audioManager.getDevices(AudioManager.GET_DEVICES_OUTPUTS)) {
            int type = device.getType();
            if (type == AudioDeviceInfo.TYPE_WIRED_HEADSET
                    || type == AudioDeviceInfo.TYPE_WIRED_HEADPHONES
                    || type == AudioDeviceInfo.TYPE_USB_HEADSET) {
                return true;
            }
        }
        return false;
    }

    private void updateWebHeadphoneStatus() {
        if (webView == null) return;
        boolean connected = areWiredHeadphonesConnected();
        mainHandler.post(() -> webView.evaluateJavascript(
                "if (window.setHeadphonesDetected) { window.setHeadphonesDetected(" + connected + "); } else if (typeof checkHeadphones === 'function') { checkHeadphones(); }",
                null
        ));
    }

    @Override
    @SuppressWarnings("deprecation")
    public void onBackPressed() {
        if (webView != null && webView.canGoBack()) {
            webView.goBack();
        } else {
            super.onBackPressed();
        }
    }

    private volatile boolean isVolumeLocked = false;

    public void setVolumeLockActive(boolean locked) {
        this.isVolumeLocked = locked;
        if (locked) {
            runOnUiThread(this::lockVolumeTo50Percent);
        }
    }

    public boolean isVolumeLockActive() {
        return this.isVolumeLocked;
    }

    public void lockVolumeTo50Percent() {
        if (audioManager != null) {
            int maxVol = audioManager.getStreamMaxVolume(AudioManager.STREAM_MUSIC);
            int targetVol = Math.max(1, Math.round(maxVol * 0.50f)); // Fijar al 50% para coincidir con C_ref = 85 dB SPL
            audioManager.setStreamVolume(AudioManager.STREAM_MUSIC, targetVol, 0);
        }
    }

    @Override
    public boolean onKeyDown(int keyCode, KeyEvent event) {
        if (isVolumeLocked && (keyCode == KeyEvent.KEYCODE_VOLUME_UP
                || keyCode == KeyEvent.KEYCODE_VOLUME_DOWN
                || keyCode == KeyEvent.KEYCODE_VOLUME_MUTE)) {
            lockVolumeTo50Percent();
            Toast.makeText(this, "El control de volumen está inhabilitado durante la prueba por motivos clínicos.", Toast.LENGTH_SHORT).show();
            return true;
        }
        return super.onKeyDown(keyCode, event);
    }

    private final class LocalAppClient extends WebViewClient {
        @Override
        public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
            return handleAssetRequest(request.getUrl());
        }

        @Override
        @SuppressWarnings("deprecation")
        public WebResourceResponse shouldInterceptRequest(WebView view, String url) {
            return handleAssetRequest(Uri.parse(url));
        }

        private WebResourceResponse handleAssetRequest(Uri uri) {
            if (uri == null) return null;
            String scheme = uri.getScheme();
            String host = uri.getHost();

            if ("https".equalsIgnoreCase(scheme) && APP_HOST.equalsIgnoreCase(host)) {
                String path = uri.getPath();
                if (path == null || "/".equals(path) || path.isEmpty()) {
                    path = "/index.html";
                }
                String assetPath = path.startsWith("/") ? path.substring(1) : path;
                return loadAsset(assetPath);
            }

            if ("file".equalsIgnoreCase(scheme)) {
                String path = uri.getPath();
                if (path != null && path.contains("android_asset")) {
                    int idx = path.indexOf("android_asset");
                    String assetPath = path.substring(idx + "android_asset".length());
                    if (assetPath.startsWith("/")) assetPath = assetPath.substring(1);
                    if (assetPath.isEmpty()) assetPath = "index.html";
                    return loadAsset(assetPath);
                }
            }

            return null;
        }

        private WebResourceResponse loadAsset(String assetPath) {
            if (assetPath.contains("..") || assetPath.contains("\\") || assetPath.isEmpty()) {
                return response(404, "Not Found", "text/plain", "Not found");
            }

            try {
                InputStream stream = getAssets().open(assetPath);
                Map<String, String> headers = new HashMap<>();
                headers.put("Cache-Control", "no-store");
                headers.put("Access-Control-Allow-Origin", "*");
                return new WebResourceResponse(mimeType(assetPath), "UTF-8", 200, "OK", headers, stream);
            } catch (FileNotFoundException exception) {
                Log.w("AudioCheck", "Asset no encontrado: " + assetPath);
                return response(404, "Not Found", "text/plain", "Not found");
            } catch (IOException exception) {
                Log.e("AudioCheck", "Error cargando asset: " + assetPath, exception);
                return response(500, "Internal Server Error", "text/plain", "Could not load app asset");
            }
        }

        @Override
        public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
            super.onReceivedError(view, request, error);
            Log.e("AudioCheck", "Error de WebView: " + error.getDescription() + " en " + request.getUrl());
            if (request.isForMainFrame()) {
                view.loadUrl("file:///android_asset/index.html");
            }
        }

        @Override
        @SuppressWarnings("deprecation")
        public void onReceivedError(WebView view, int errorCode, String description, String failingUrl) {
            super.onReceivedError(view, errorCode, description, failingUrl);
            Log.e("AudioCheck", "Error de WebView (" + errorCode + "): " + description + " en " + failingUrl);
            view.loadUrl("file:///android_asset/index.html");
        }

        @Override
        public void onReceivedSslError(WebView view, SslErrorHandler handler, SslError error) {
            Log.w("AudioCheck", "SSL error ignorado para asset virtual: " + error);
            handler.proceed();
        }

        @Override
        public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
            Uri uri = request.getUrl();
            return !"https".equalsIgnoreCase(uri.getScheme()) || !APP_HOST.equalsIgnoreCase(uri.getHost());
        }

        @Override
        @SuppressWarnings("deprecation")
        public boolean shouldOverrideUrlLoading(WebView view, String url) {
            Uri uri = Uri.parse(url);
            return !"https".equalsIgnoreCase(uri.getScheme()) || !APP_HOST.equalsIgnoreCase(uri.getHost());
        }
    }

    private static WebResourceResponse response(int status, String reason, String mime, String body) {
        Map<String, String> headers = new HashMap<>();
        headers.put("Cache-Control", "no-store");
        return new WebResourceResponse(
                mime,
                "UTF-8",
                status,
                reason,
                headers,
                new java.io.ByteArrayInputStream(body.getBytes(java.nio.charset.StandardCharsets.UTF_8))
        );
    }

    private static String mimeType(String path) {
        String lower = path.toLowerCase(Locale.ROOT);
        if (lower.endsWith(".html")) return "text/html";
        if (lower.endsWith(".css")) return "text/css";
        if (lower.endsWith(".js")) return "application/javascript";
        if (lower.endsWith(".svg")) return "image/svg+xml";
        if (lower.endsWith(".png")) return "image/png";
        if (lower.endsWith(".webmanifest") || lower.endsWith(".json")) return "application/manifest+json";
        return "application/octet-stream";
    }

    public String getAudioOutputType() {
        if (audioManager == null) return "unknown";
        AudioDeviceInfo[] devices = audioManager.getDevices(AudioManager.GET_DEVICES_OUTPUTS);
        boolean bluetooth = false;
        for (AudioDeviceInfo device : devices) {
            int type = device.getType();
            if (type == AudioDeviceInfo.TYPE_WIRED_HEADPHONES
                    || type == AudioDeviceInfo.TYPE_WIRED_HEADSET
                    || type == AudioDeviceInfo.TYPE_USB_HEADSET) {
                return "wired";
            }
            if (type == AudioDeviceInfo.TYPE_BLUETOOTH_A2DP
                    || (Build.VERSION.SDK_INT >= 31 && type == AudioDeviceInfo.TYPE_BLE_HEADSET)) {
                bluetooth = true;
            }
        }
        if (bluetooth) {
            return "bluetooth";
        }
        return "unknown";
    }

    public boolean isHeadphonesConnected() {
        return areWiredHeadphonesConnected();
    }

    public void notifyHeadphonesDisconnected() {
        mainHandler.post(() -> Toast.makeText(
                MainActivity.this,
                "Auriculares desconectados, la prueba se reiniciará",
                Toast.LENGTH_LONG
        ).show());
    }

    public void exportPdf(String json, boolean share) {
        handlePdfBase64(json, "Audiometria.pdf", share);
    }

    public void handlePdfBase64(String base64OrJson, String filename, boolean share) {
        new Thread(() -> {
            try {
                String cleanFilename = (filename == null || filename.trim().isEmpty() || "false".equalsIgnoreCase(filename) || "true".equalsIgnoreCase(filename))
                        ? "Audiometria.pdf"
                        : (filename.toLowerCase(Locale.ROOT).endsWith(".pdf") ? filename : filename + ".pdf");

                byte[] pdfBytes;
                String trimmed = base64OrJson != null ? base64OrJson.trim() : "";
                if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
                    ParsedReportData data = parseReportData(trimmed);
                    pdfBytes = createPdf(data.measurements, data.patientName, data.patientAge, data.observations);
                    if (data.patientName != null && !data.patientName.trim().isEmpty()) {
                        cleanFilename = buildPdfFilename(data.patientName);
                    }
                } else {
                    String cleanBase64 = base64OrJson.contains(",") ? base64OrJson.substring(base64OrJson.indexOf(",") + 1) : base64OrJson;
                    pdfBytes = android.util.Base64.decode(cleanBase64, android.util.Base64.DEFAULT);
                }

                final String finalFilename = cleanFilename;
                final byte[] finalPdf = pdfBytes;

                if (share) {
                    mainHandler.post(() -> MainActivity.this.sharePdf(finalPdf, finalFilename));
                } else {
                    savePdfToDownloads(finalPdf, finalFilename);
                    mainHandler.post(() -> {
                        postDownloadNotification(finalFilename, finalPdf);
                        Toast.makeText(
                                MainActivity.this,
                                "PDF guardado en Descargas/Audio Check",
                                Toast.LENGTH_LONG
                        ).show();
                    });
                }
            } catch (Exception exception) {
                Log.e("AudioCheck", "Error en handlePdfBase64: " + exception.getMessage(), exception);
                String message = exception.getMessage() == null
                        ? "No se pudo generar el PDF."
                        : "No se pudo generar el PDF: " + exception.getMessage();
                mainHandler.post(() -> Toast.makeText(MainActivity.this, message, Toast.LENGTH_LONG).show());
            }
        }, "audio-check-base64-pdf").start();
    }

    public static class ParsedReportData {
        List<Measurement> measurements = new ArrayList<>();
        String patientName;
        Integer patientAge;
        String observations;
    }

    private ParsedReportData parseReportData(String json) throws Exception {
        ParsedReportData data = new ParsedReportData();
        JSONArray values;
        String trimmed = json != null ? json.trim() : "";
        if (trimmed.startsWith("{")) {
            JSONObject obj = new JSONObject(trimmed);
            values = obj.getJSONArray("measurements");
            if (obj.has("patient_name") && !obj.isNull("patient_name")) {
                data.patientName = obj.optString("patient_name", null);
            }
            if (obj.has("patient_age") && !obj.isNull("patient_age")) {
                data.patientAge = obj.optInt("patient_age", -1);
                if (data.patientAge <= 0) data.patientAge = null;
            }
            if (obj.has("observations") && !obj.isNull("observations")) {
                data.observations = obj.optString("observations", null);
            } else if (obj.has("observaciones") && !obj.isNull("observaciones")) {
                data.observations = obj.optString("observaciones", null);
            }
        } else {
            values = new JSONArray(trimmed);
        }

        if (values.length() == 0) {
            throw new IllegalArgumentException("No hay mediciones para exportar.");
        }

        for (int i = 0; i < values.length(); i++) {
            JSONObject value = values.getJSONObject(i);
            String ear = value.getString("ear");
            int frequency = value.getInt("frequency_hz");
            if (!"left".equals(ear) && !"right".equals(ear)) {
                continue;
            }
            if (!isFrequency(frequency)) {
                continue;
            }
            boolean noResponse = value.optBoolean("no_response", false);
            Integer level = null;
            if (value.has("level_dbhl") && !value.isNull("level_dbhl")) {
                level = (int) Math.round(value.getDouble("level_dbhl"));
            } else if (value.has("level_dbfs") && !value.isNull("level_dbfs")) {
                double dbfs = value.getDouble("level_dbfs");
                level = (int) Math.round((dbfs + 60) * 2.5);
            }
            if (level != null && (level < 0 || level > 120)) {
                continue;
            }
            data.measurements.add(new Measurement(ear, frequency, level, noResponse));
        }

        if (data.measurements.isEmpty()) {
            throw new IllegalArgumentException("No hay mediciones válidas para exportar.");
        }
        return data;
    }

    private static boolean isFrequency(int frequency) {
        for (int valid : FREQUENCIES) {
            if (frequency == valid) return true;
        }
        return false;
    }

    private static String buildPdfFilename(String patientName) {
        String stamp = new SimpleDateFormat("yyyyMMdd_HHmmss", Locale.US).format(new Date());
        String filename = "Audiometria_" + stamp + ".pdf";
        if (patientName != null && !patientName.trim().isEmpty()) {
            String safe = Normalizer.normalize(patientName.trim(), Normalizer.Form.NFD)
                    .replaceAll("\\p{InCombiningDiacriticalMarks}+", "")
                    .replaceAll("[^a-zA-Z0-9_-]+", "_")
                    .replaceAll("^_+|_+$", "");
            if (!safe.isEmpty()) {
                filename = "Audiometria_" + safe + "_" + stamp + ".pdf";
            }
        }
        return filename;
    }

    private Uri savePdfToDownloads(byte[] pdf, String filename) throws Exception {
        ContentValues values = new ContentValues();
        values.put(MediaStore.MediaColumns.DISPLAY_NAME, filename);
        values.put(MediaStore.MediaColumns.MIME_TYPE, "application/pdf");
        values.put(MediaStore.MediaColumns.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS + "/Audio Check");
        values.put(MediaStore.MediaColumns.IS_PENDING, 1);

        Uri uri = getContentResolver().insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values);
        if (uri == null) {
            values.put(MediaStore.MediaColumns.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS);
            uri = getContentResolver().insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values);
        }
        if (uri == null) {
            throw new IllegalStateException("Android no pudo preparar el archivo en Descargas.");
        }
        try {
            try (OutputStream output = getContentResolver().openOutputStream(uri)) {
                if (output == null) throw new IllegalStateException("Android no pudo escribir el archivo.");
                output.write(pdf);
                output.flush();
            }
            ContentValues ready = new ContentValues();
            ready.put(MediaStore.MediaColumns.IS_PENDING, 0);
            try {
                getContentResolver().update(uri, ready, null, null);
            } catch (Exception ignored) {
            }
            return uri;
        } catch (Exception exception) {
            getContentResolver().delete(uri, null, null);
            throw exception;
        }
    }

    private void postDownloadNotification(String filename, byte[] pdf) {
        try {
            NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
            if (nm == null) return;

            String channelId = "audio_check_downloads";
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                NotificationChannel channel = new NotificationChannel(
                        channelId,
                        "Descargas de Reportes",
                        NotificationManager.IMPORTANCE_HIGH
                );
                channel.setDescription("Notificaciones de reportes PDF descargados");
                nm.createNotificationChannel(channel);
            }

            File cacheFile = new File(getCacheDir(), filename);
            try (FileOutputStream fos = new FileOutputStream(cacheFile)) {
                fos.write(pdf);
                fos.flush();
            }
            Uri viewUri = Uri.parse("content://" + PdfFileProvider.AUTHORITY + "/" + filename);

            Intent viewIntent = new Intent(Intent.ACTION_VIEW);
            viewIntent.setDataAndType(viewUri, "application/pdf");
            viewIntent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
            viewIntent.setClipData(android.content.ClipData.newUri(getContentResolver(), filename, viewUri));

            PendingIntent pendingIntent = PendingIntent.getActivity(
                    this,
                    (int) (System.currentTimeMillis() % 100000),
                    viewIntent,
                    PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
            );

            Notification.Builder builder = Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
                    ? new Notification.Builder(this, channelId)
                    : new Notification.Builder(this);

            Notification notification = builder
                    .setSmallIcon(android.R.drawable.stat_sys_download_done)
                    .setContentTitle("Descarga completada")
                    .setContentText(filename)
                    .setContentIntent(pendingIntent)
                    .setAutoCancel(true)
                    .build();

            nm.notify(1001, notification);
        } catch (Exception e) {
            Log.w("AudioCheck", "No se pudo mostrar la notificación: " + e.getMessage());
        }
    }

    private void sharePdf(byte[] pdf, String filename) {
        try {
            File cacheFile = new File(getCacheDir(), filename);
            try (FileOutputStream out = new FileOutputStream(cacheFile)) {
                out.write(pdf);
                out.flush();
            }
            Uri contentUri = Uri.parse("content://" + PdfFileProvider.AUTHORITY + "/" + filename);

            Intent send = new Intent(Intent.ACTION_SEND);
            send.setType("application/pdf");
            send.putExtra(Intent.EXTRA_STREAM, contentUri);
            send.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            send.setClipData(android.content.ClipData.newUri(getContentResolver(), filename, contentUri));

            Intent chooser = Intent.createChooser(send, "Compartir resumen auditivo");
            chooser.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
            startActivity(chooser);
        } catch (Exception e) {
            Log.e("AudioCheck", "Error al compartir PDF: " + e.getMessage(), e);
            Toast.makeText(this, "No se pudo abrir el menú para compartir: " + e.getMessage(), Toast.LENGTH_LONG).show();
        }
    }

    private static byte[] createPdf(List<Measurement> measurements, String patientName, Integer patientAge, String observations) throws Exception {
        PdfDocument document = new PdfDocument();
        PdfDocument.Page page = document.startPage(
                new PdfDocument.PageInfo.Builder(792, 612, 1).create()
        );
        Canvas canvas = page.getCanvas();
        canvas.drawColor(0xffffffff);

        Paint paint = new Paint(Paint.ANTI_ALIAS_FLAG);
        paint.setColor(INK);
        paint.setTypeface(Typeface.create(Typeface.SANS_SERIF, Typeface.BOLD));
        paint.setTextSize(22);
        canvas.drawText("Resumen auditivo", 48, 52, paint);

        paint.setColor(MUTED);
        paint.setTypeface(Typeface.create(Typeface.SANS_SERIF, Typeface.NORMAL));
        paint.setTextSize(10);
        canvas.drawText("Umbral auditivo relativo estimado · dB HL (re: ajuste biológico 1 kHz / RETSPL)", 48, 68, paint);

        if (patientName != null || patientAge != null) {
            StringBuilder info = new StringBuilder();
            if (patientName != null && !patientName.trim().isEmpty()) {
                info.append("Paciente: ").append(patientName.trim());
            }
            if (patientAge != null) {
                if (info.length() > 0) info.append("   ·   ");
                info.append("Edad: ").append(patientAge).append(" años");
            }
            if (info.length() > 0) {
                paint.setColor(INK);
                paint.setTypeface(Typeface.create(Typeface.SANS_SERIF, Typeface.BOLD));
                paint.setTextSize(10);
                paint.setTextAlign(Paint.Align.LEFT);
                canvas.drawText(info.toString(), 48, 84, paint);
            }
        }

        float left = 96;
        float right = 750;
        float bottom = 455;
        float top = 118;
        for (int level = 0; level <= 100; level += 20) {
            float y = yPosition(level, top, bottom);
            paint.setColor(GRID);
            paint.setStrokeWidth(0.6f);
            canvas.drawLine(left, y, right, y, paint);
            paint.setColor(MUTED);
            paint.setTextSize(9);
            paint.setTextAlign(Paint.Align.RIGHT);
            canvas.drawText(String.valueOf(level), left - 10, y + 3, paint);
        }

        for (int frequency : FREQUENCIES) {
            float x = xPosition(frequency, left, right);
            paint.setColor(0xffe8eeeb);
            canvas.drawLine(x, bottom, x, top, paint);
            paint.setColor(MUTED);
            paint.setTextAlign(Paint.Align.CENTER);
            canvas.drawText(String.valueOf(frequency), x, bottom + 16, paint);
        }

        paint.setColor(INK);
        paint.setTextSize(9);
        canvas.drawText("Frecuencia (Hz)", (left + right) / 2, bottom + 32, paint);
        canvas.save();
        canvas.rotate(-90, 34, (bottom + top) / 2);
        paint.setTextAlign(Paint.Align.CENTER);
        canvas.drawText("Nivel de audición (dB HL)", 34, (bottom + top) / 2, paint);
        canvas.restore();

        // Trazo de curva de referencia ideal por edad (ISO 7029)
        int[] isoCurve = getIso7029Curve(patientAge);
        String rangoNombre = getIso7029RangeName(patientAge);
        String refLabel = "Referencia por edad (" + rangoNombre + ")";

        Paint refPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
        refPaint.setColor(0xff6b1d2f);
        refPaint.setStrokeWidth(1.6f);
        refPaint.setStyle(Paint.Style.STROKE);
        refPaint.setPathEffect(new android.graphics.DashPathEffect(new float[]{8f, 6f}, 0));

        android.graphics.Path refPath = new android.graphics.Path();
        for (int i = 0; i < FREQUENCIES.length; i++) {
            float x = xPosition(FREQUENCIES[i], left, right);
            float y = yPosition(isoCurve[i], top, bottom);
            if (i == 0) {
                refPath.moveTo(x, y);
            } else {
                refPath.lineTo(x, y);
            }
        }
        canvas.drawPath(refPath, refPaint);

        refPaint.setPathEffect(null);
        refPaint.setStyle(Paint.Style.FILL);
        for (int i = 0; i < FREQUENCIES.length; i++) {
            float x = xPosition(FREQUENCIES[i], left, right);
            float y = yPosition(isoCurve[i], top, bottom);
            canvas.drawCircle(x, y, 2.5f, refPaint);
        }

        drawSeries(canvas, paint, measurements, "left", LEFT, left, right, top, bottom);
        drawSeries(canvas, paint, measurements, "right", RIGHT, left, right, top, bottom);

        // Leyenda: Oído izquierdo, Oído derecho y Referencia por edad
        float legLeftX = right - 325;
        paint.setColor(LEFT);
        paint.setStyle(Paint.Style.FILL);
        canvas.drawCircle(legLeftX, 73, 3.5f, paint);
        paint.setColor(MUTED);
        paint.setTextAlign(Paint.Align.LEFT);
        paint.setTextSize(8);
        canvas.drawText("Oído izquierdo", legLeftX + 8, 76, paint);

        float legRightX = right - 240;
        paint.setColor(RIGHT);
        paint.setStyle(Paint.Style.FILL);
        canvas.drawCircle(legRightX, 73, 3.5f, paint);
        paint.setColor(MUTED);
        paint.setTextAlign(Paint.Align.LEFT);
        paint.setTextSize(8);
        canvas.drawText("Oído derecho", legRightX + 8, 76, paint);

        float legRefX = right - 155;
        paint.setColor(0xff6b1d2f);
        paint.setStyle(Paint.Style.STROKE);
        paint.setStrokeWidth(1.4f);
        paint.setPathEffect(new android.graphics.DashPathEffect(new float[]{5f, 4f}, 0));
        canvas.drawLine(legRefX - 12, 73, legRefX + 6, 73, paint);
        paint.setPathEffect(null);
        paint.setStyle(Paint.Style.FILL);
        canvas.drawCircle(legRefX - 3, 73, 2.5f, paint);
        paint.setColor(MUTED);
        paint.setTextAlign(Paint.Align.LEFT);
        paint.setTextSize(8);
        canvas.drawText(refLabel, legRefX + 10, 76, paint);

        // Marco y Nota técnica ampliada para óptima legibilidad
        paint.setColor(0xfff8faf9);
        paint.setStyle(Paint.Style.FILL);
        canvas.drawRoundRect(left, 494, right, 568, 4, 4, paint);
        paint.setColor(0xffdc684c);
        paint.setStrokeWidth(3);
        canvas.drawLine(left, 494, left, 568, paint);

        paint.setTextAlign(Paint.Align.LEFT);
        paint.setTextSize(7.8f);
        paint.setColor(0xff8a5140);
        paint.setTypeface(Typeface.create(Typeface.SANS_SERIF, Typeface.BOLD));
        canvas.drawText("Nota técnica: ", left + 12, 508, paint);
        float leadW = paint.measureText("Nota técnica: ");

        paint.setColor(0xff3d4d48);
        paint.setTypeface(Typeface.create(Typeface.SANS_SERIF, Typeface.NORMAL));
        canvas.drawText("Resultados expresados en escala relativa aproximada (dB HL re: compensación RETSPL ANSI S3.6 y ajuste biológico previo). En hardware", left + 12 + leadW, 508, paint);
        canvas.drawText("de consumo sin calibración electroacústica en acoplador (IEC 60318), el nivel de presión sonora real varía según el DAC, la impedancia", left + 12, 521, paint);
        canvas.drawText("del transductor y la curva de volumen del sistema operativo, pudiendo inducir desfases sistemáticos de 30–60 dB cuando se emplea únicamente", left + 12, 534, paint);
        canvas.drawText("un porcentaje fijo de volumen. La literatura reporta una incertidumbre residual de σ ≈ ±7–10 dB únicamente tras aplicar calibración", left + 12, 547, paint);
        canvas.drawText("biológica por dispositivo (Masalski et al., 2014). Herramienta de tamizaje académico en psicoacústica; no sustituye una audiometría diagnóstica clínica.", left + 12, 560, paint);

        paint.setColor(0xff8a0303);
        paint.setTypeface(Typeface.create(Typeface.SANS_SERIF, Typeface.BOLD));
        paint.setTextSize(9.5f);
        paint.setTextAlign(Paint.Align.CENTER);
        canvas.drawText("Esta gráfica es referencial y no sustituye un diagnóstico audiológico profesional.", 396, 578, paint);

        paint.setColor(MUTED);
        paint.setTypeface(Typeface.create(Typeface.SANS_SERIF, Typeface.NORMAL));
        paint.setTextSize(7.5f);
        canvas.drawText("Desarrollado por Cielo Isabel Ochoa y Juan José Guerrero · Ing. de Sonido, Univ. de San Buenaventura Medellín · Psicoacústica 2026-2", 396, 594, paint);

        document.finishPage(page);
        ByteArrayOutputStream output = new ByteArrayOutputStream();
        document.writeTo(output);
        document.close();
        return output.toByteArray();
    }

    private static int[] getIso7029Curve(Integer age) {
        if (age == null || age < 1) {
            return new int[]{5, 5, 5, 5, 5, 10};
        } else if (age <= 19) {
            return new int[]{0, 0, 0, 0, 0, 0};
        } else if (age <= 39) {
            return new int[]{5, 5, 5, 5, 5, 10};
        } else if (age <= 59) {
            return new int[]{5, 5, 5, 10, 15, 25};
        } else {
            return new int[]{10, 10, 10, 15, 30, 50};
        }
    }

    private static String getIso7029RangeName(Integer age) {
        if (age == null || age < 1) {
            return "20-39 años";
        } else if (age <= 19) {
            return "1-19 años";
        } else if (age <= 39) {
            return "20-39 años";
        } else if (age <= 59) {
            return "40-59 años";
        } else {
            return "60+ años";
        }
    }

    private static void drawSeries(
            Canvas canvas,
            Paint paint,
            List<Measurement> measurements,
            String ear,
            int color,
            float left,
            float right,
            float top,
            float bottom
    ) {
        List<float[]> points = new ArrayList<>();
        for (int frequency : FREQUENCIES) {
            for (Measurement measurement : measurements) {
                if (ear.equals(measurement.ear)
                        && frequency == measurement.frequency
                        && measurement.level != null) {
                    points.add(new float[]{
                            xPosition(frequency, left, right),
                            yPosition(measurement.level, top, bottom)
                    });
                    break;
                }
            }
        }

        paint.setColor(color);
        paint.setStrokeWidth(1.6f);
        paint.setStyle(Paint.Style.STROKE);
        for (int i = 1; i < points.size(); i++) {
            float[] first = points.get(i - 1);
            float[] second = points.get(i);
            canvas.drawLine(first[0], first[1], second[0], second[1], paint);
        }
        paint.setStyle(Paint.Style.FILL);
        for (float[] point : points) {
            canvas.drawCircle(point[0], point[1], 4, paint);
        }

        // Indicador clínico de No Respuesta (NR): flecha descendente en 100 dB HL
        for (Measurement measurement : measurements) {
            if (ear.equals(measurement.ear) && measurement.noResponse) {
                float nx = xPosition(measurement.frequency, left, right) + ("left".equals(ear) ? -4 : 4);
                float ny = yPosition(100, top, bottom);
                paint.setColor(color);
                paint.setStyle(Paint.Style.FILL);
                android.graphics.Path path = new android.graphics.Path();
                path.moveTo(nx - 4, ny - 6);
                path.lineTo(nx + 4, ny - 6);
                path.lineTo(nx, ny + 2);
                path.close();
                canvas.drawPath(path, paint);
            }
        }
    }

    // Eje X equidistante: cada frecuencia ocupa una columna fija según su índice, igual que reports.py.
    private static float xPosition(int frequency, float left, float right) {
        int index = 0;
        for (int i = 0; i < FREQUENCIES.length; i++) {
            if (FREQUENCIES[i] == frequency) {
                index = i;
                break;
            }
        }
        float columnWidth = (right - left) / (FREQUENCIES.length - 1);
        return left + index * columnWidth;
    }

    private static float yPosition(int level, float top, float bottom) {
        return top + (level / 100f) * (bottom - top);
    }

    private static final class Measurement {
        final String ear;
        final int frequency;
        final Integer level;
        final boolean noResponse;

        Measurement(String ear, int frequency, Integer level, boolean noResponse) {
            this.ear = ear;
            this.frequency = frequency;
            this.level = level;
            this.noResponse = noResponse;
        }
    }
}
