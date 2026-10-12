package com.audiocheck.app;

import android.app.Activity;
import android.content.ContentValues;
import android.content.Intent;
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
import android.webkit.JavascriptInterface;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.FileNotFoundException;
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
    private static final int[] FREQUENCIES = {250, 500, 1000, 2000, 3000, 4000, 6000, 8000};
    private static final int MAX_MEASUREMENTS = FREQUENCIES.length * 2;

    private final Handler mainHandler = new Handler(Looper.getMainLooper());
    private WebView webView;
    private AudioManager audioManager;
    private AudioDeviceCallback audioDeviceCallback;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        audioManager = (AudioManager) getSystemService(AUDIO_SERVICE);
        webView = new WebView(this);
        webView.setBackgroundColor(0xfff3f5ef);
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setMediaPlaybackRequiresUserGesture(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);
        settings.setSupportMultipleWindows(false);
        webView.addJavascriptInterface(new AndroidBridge(), "AndroidApp");
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
        updateWebHeadphoneStatus();
    }

    @Override
    protected void onDestroy() {
        if (audioManager != null && audioDeviceCallback != null) {
            audioManager.unregisterAudioDeviceCallback(audioDeviceCallback);
        }
        super.onDestroy();
    }

    private boolean areWiredHeadphonesConnected() {
        if (audioManager == null) return false;
        for (AudioDeviceInfo device : audioManager.getDevices(AudioManager.GET_DEVICES_OUTPUTS)) {
            int type = device.getType();
            if (type == AudioDeviceInfo.TYPE_WIRED_HEADSET
                    || type == AudioDeviceInfo.TYPE_WIRED_HEADPHONES
                    || type == AudioDeviceInfo.TYPE_USB_HEADSET
                    || type == AudioDeviceInfo.TYPE_USB_DEVICE) {
                return true;
            }
        }
        return false;
    }

    private void updateWebHeadphoneStatus() {
        if (webView == null) return;
        boolean connected = areWiredHeadphonesConnected();
        mainHandler.post(() -> webView.evaluateJavascript(
                "if (typeof checkHeadphones === 'function') { checkHeadphones(); } else if (window.setHeadphonesDetected) { window.setHeadphonesDetected(" + connected + "); }",
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

    @Override
    public boolean onKeyDown(int keyCode, KeyEvent event) {
        if (keyCode == KeyEvent.KEYCODE_VOLUME_UP || keyCode == KeyEvent.KEYCODE_VOLUME_DOWN) {
            Toast.makeText(this, "El control de volumen está inhabilitado por motivos clínicos.", Toast.LENGTH_SHORT).show();
            return true;
        }
        return super.onKeyDown(keyCode, event);
    }

    private final class LocalAppClient extends WebViewClient {
        @Override
        public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
            Uri uri = request.getUrl();
            if (!"https".equals(uri.getScheme()) || !APP_HOST.equals(uri.getHost())) {
                return response(403, "Forbidden", "text/plain", "Blocked");
            }

            String path = uri.getPath();
            if (path == null || "/".equals(path)) {
                path = "/index.html";
            }
            String assetPath = path.startsWith("/") ? path.substring(1) : path;
            if (assetPath.contains("..") || assetPath.contains("\\") || assetPath.isEmpty()) {
                return response(404, "Not Found", "text/plain", "Not found");
            }

            try {
                InputStream stream = getAssets().open(assetPath);
                Map<String, String> headers = new HashMap<>();
                headers.put("Cache-Control", "no-store");
                return new WebResourceResponse(mimeType(assetPath), "UTF-8", 200, "OK", headers, stream);
            } catch (FileNotFoundException exception) {
                return response(404, "Not Found", "text/plain", "Not found");
            } catch (IOException exception) {
                Log.e("AudioCheck", "Could not load bundled app asset: " + assetPath, exception);
                return response(500, "Internal Server Error", "text/plain", "Could not load app asset");
            }
        }

        @Override
        public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
            Uri uri = request.getUrl();
            return !"https".equals(uri.getScheme()) || !APP_HOST.equals(uri.getHost());
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

    private final class AndroidBridge {
        @JavascriptInterface
        public String getAudioOutputType() {
            if (audioManager == null) return "unknown";
            AudioDeviceInfo[] devices = audioManager.getDevices(AudioManager.GET_DEVICES_OUTPUTS);
            boolean bluetooth = false;
            for (AudioDeviceInfo device : devices) {
                int type = device.getType();
                if (type == AudioDeviceInfo.TYPE_WIRED_HEADPHONES
                        || type == AudioDeviceInfo.TYPE_WIRED_HEADSET
                        || type == AudioDeviceInfo.TYPE_USB_HEADSET
                        || type == AudioDeviceInfo.TYPE_USB_DEVICE) {
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

        @JavascriptInterface
        public boolean isHeadphonesConnected() {
            return areWiredHeadphonesConnected();
        }

        @JavascriptInterface
        public void exportPdf(String json, boolean share) {
            new Thread(() -> {
                Uri pdfUri = null;
                try {
                    ParsedReportData data = parseReportData(json);
                    byte[] pdf = createPdf(data.measurements, data.patientName, data.patientAge);
                    pdfUri = savePdf(pdf, data.patientName);
                    Uri savedUri = pdfUri;
                    mainHandler.post(() -> {
                        if (share) {
                            sharePdf(savedUri);
                        } else {
                            Toast.makeText(
                                    MainActivity.this,
                                    "PDF guardado en Descargas/Audio Check",
                                    Toast.LENGTH_LONG
                            ).show();
                        }
                    });
                } catch (Exception exception) {
                    if (pdfUri != null) {
                        getContentResolver().delete(pdfUri, null, null);
                    }
                    String message = exception.getMessage() == null
                            ? "No se pudo crear el PDF."
                            : "No se pudo crear el PDF: " + exception.getMessage();
                    mainHandler.post(() -> Toast.makeText(MainActivity.this, message, Toast.LENGTH_LONG).show());
                }
            }, "audio-check-pdf").start();
        }
    }

    private static class ParsedReportData {
        List<Measurement> measurements = new ArrayList<>();
        String patientName;
        Integer patientAge;
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
        } else {
            values = new JSONArray(trimmed);
        }

        if (values.length() == 0 || values.length() > MAX_MEASUREMENTS) {
            throw new IllegalArgumentException("No hay mediciones para exportar.");
        }

        for (int i = 0; i < values.length(); i++) {
            JSONObject value = values.getJSONObject(i);
            String ear = value.getString("ear");
            int frequency = value.getInt("frequency_hz");
            if (!"left".equals(ear) && !"right".equals(ear)) {
                throw new IllegalArgumentException("Oído no válido.");
            }
            if (!isFrequency(frequency)) {
                throw new IllegalArgumentException("Frecuencia no válida.");
            }
            Integer level = value.isNull("level_dbfs") ? null : value.getInt("level_dbfs");
            if (level != null && (level < -60 || level > -20)) {
                throw new IllegalArgumentException("Nivel no válido.");
            }
            data.measurements.add(new Measurement(ear, frequency, level));
        }
        return data;
    }

    private static boolean isFrequency(int frequency) {
        for (int valid : FREQUENCIES) {
            if (frequency == valid) return true;
        }
        return false;
    }

    private Uri savePdf(byte[] pdf, String patientName) throws Exception {
        String filename = "Audiometria.pdf";
        if (patientName != null && !patientName.trim().isEmpty()) {
            String safe = Normalizer.normalize(patientName.trim(), Normalizer.Form.NFD)
                    .replaceAll("\\p{InCombiningDiacriticalMarks}+", "")
                    .replaceAll("[^a-zA-Z0-9_-]+", "_")
                    .replaceAll("^_+|_+$", "");
            if (!safe.isEmpty()) {
                filename = "Audiometria_" + safe + ".pdf";
            }
        }
        ContentValues values = new ContentValues();
        values.put(MediaStore.MediaColumns.DISPLAY_NAME, filename);
        values.put(MediaStore.MediaColumns.MIME_TYPE, "application/pdf");
        values.put(MediaStore.MediaColumns.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS + "/Audio Check");
        values.put(MediaStore.MediaColumns.IS_PENDING, 1);

        Uri uri = getContentResolver().insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values);
        if (uri == null) {
            throw new IllegalStateException("Android no pudo preparar el archivo.");
        }
        try {
            try (OutputStream output = getContentResolver().openOutputStream(uri)) {
                if (output == null) throw new IllegalStateException("Android no pudo guardar el archivo.");
                output.write(pdf);
            }
            ContentValues ready = new ContentValues();
            ready.put(MediaStore.MediaColumns.IS_PENDING, 0);
            if (getContentResolver().update(uri, ready, null, null) == 0) {
                throw new IllegalStateException("Android no pudo terminar de guardar el archivo.");
            }
            return uri;
        } catch (Exception exception) {
            getContentResolver().delete(uri, null, null);
            throw exception;
        }
    }

    private void sharePdf(Uri uri) {
        Intent send = new Intent(Intent.ACTION_SEND);
        send.setType("application/pdf");
        send.putExtra(Intent.EXTRA_STREAM, uri);
        send.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
        send.setClipData(android.content.ClipData.newUri(getContentResolver(), "Resumen auditivo", uri));
        startActivity(Intent.createChooser(send, "Compartir resumen auditivo"));
    }

    private static byte[] createPdf(List<Measurement> measurements, String patientName, Integer patientAge) throws Exception {
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
        canvas.drawText("Registro exploratorio · niveles digitales relativos (dBFS)", 48, 68, paint);

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
        float bottom = 500;
        float top = 118;
        for (int level = 0; level >= -100; level -= 20) {
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
            canvas.drawText(String.valueOf(frequency), x, bottom + 17, paint);
        }

        paint.setColor(INK);
        paint.setTextSize(9);
        canvas.drawText("Frecuencia (Hz)", (left + right) / 2, bottom + 36, paint);
        canvas.save();
        canvas.rotate(-90, 34, (bottom + top) / 2);
        paint.setTextAlign(Paint.Align.CENTER);
        canvas.drawText("Nivel relativo indicado (dBFS, no calibrado)", 34, (bottom + top) / 2, paint);
        canvas.restore();

        drawSeries(canvas, paint, measurements, "left", LEFT, "Oído izquierdo", left, right, top, bottom);
        drawSeries(canvas, paint, measurements, "right", RIGHT, "Oído derecho", left, right, top, bottom);

        paint.setColor(0xff8a5140);
        paint.setTypeface(Typeface.create(Typeface.SANS_SERIF, Typeface.BOLD));
        paint.setTextAlign(Paint.Align.LEFT);
        paint.setTextSize(9);
        canvas.drawText("No es una audiometría clínica. No representa dB SPL ni dB HL.", left, 543, paint);
        paint.setColor(MUTED);
        paint.setTypeface(Typeface.create(Typeface.SANS_SERIF, Typeface.NORMAL));
        paint.setTextSize(8);
        canvas.drawText("Los resultados se expresan en escala digital (dBFS). Al carecer de calibración con sonómetro, no equivalen a niveles clínicos estándar (dB HL).", left, 558, paint);

        paint.setTextSize(7.5f);
        paint.setTextAlign(Paint.Align.CENTER);
        canvas.drawText("Desarrollado por Cielo Isabel Ochoa y Juan José Guerrero · Ing. de Sonido, Univ. de San Buenaventura Medellín · Psicoacústica 2026-2", 396, 582, paint);

        document.finishPage(page);
        ByteArrayOutputStream output = new ByteArrayOutputStream();
        document.writeTo(output);
        document.close();
        return output.toByteArray();
    }

    private static void drawSeries(
            Canvas canvas,
            Paint paint,
            List<Measurement> measurements,
            String ear,
            int color,
            String label,
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

        float legendX = "left".equals(ear) ? right - 145 : right - 55;
        canvas.drawCircle(legendX, 73, 3, paint);
        paint.setColor(MUTED);
        paint.setTextAlign(Paint.Align.LEFT);
        paint.setTextSize(8);
        canvas.drawText(label, legendX + 8, 76, paint);
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
        return top + (-level / 100f) * (bottom - top);
    }

    private static final class Measurement {
        final String ear;
        final int frequency;
        final Integer level;

        Measurement(String ear, int frequency, Integer level) {
            this.ear = ear;
            this.frequency = frequency;
            this.level = level;
        }
    }
}
