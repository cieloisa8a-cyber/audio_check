package com.audiocheck.app;

import android.webkit.JavascriptInterface;

public class AndroidBridge {
    private final MainActivity activity;

    public AndroidBridge(MainActivity activity) {
        this.activity = activity;
    }

    @JavascriptInterface
    public String getAudioOutputType() {
        return activity != null ? activity.getAudioOutputType() : "unknown";
    }

    @JavascriptInterface
    public boolean isHeadphonesConnected() {
        return activity != null && activity.isHeadphonesConnected();
    }

    @JavascriptInterface
    public void notifyHeadphonesDisconnected() {
        if (activity != null) {
            activity.notifyHeadphonesDisconnected();
        }
    }

    @JavascriptInterface
    public void lockVolumeTo50Percent() {
        if (activity != null) {
            activity.runOnUiThread(activity::lockVolumeTo50Percent);
        }
    }

    @JavascriptInterface
    public void exportPdf(String json, boolean share) {
        if (activity != null) {
            activity.exportPdf(json, share);
        }
    }

    @JavascriptInterface
    public void exportPdf(String json) {
        exportPdf(json, false);
    }

    @JavascriptInterface
    public void exportPDF(String json, boolean share) {
        exportPdf(json, share);
    }

    @JavascriptInterface
    public void exportPDF(String json) {
        exportPdf(json, false);
    }

    @JavascriptInterface
    public void sharePdf(String json) {
        exportPdf(json, true);
    }

    @JavascriptInterface
    public void sharePDF(String json) {
        exportPdf(json, true);
    }
}
