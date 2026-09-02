package com.aristotle.pos;

import android.Manifest;
import android.annotation.SuppressLint;
import android.app.AlertDialog;
import android.bluetooth.BluetoothAdapter;
import android.bluetooth.BluetoothDevice;
import android.bluetooth.BluetoothSocket;
import android.content.Intent;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import android.util.Base64;
import android.util.Log;
import android.webkit.GeolocationPermissions;
import android.webkit.JavascriptInterface;
import android.webkit.JsResult;
import android.webkit.PermissionRequest;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.IOException;
import java.io.OutputStream;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public class MainActivity extends AppCompatActivity {

    private static final String TAG = "AristotlePOS";
    private static final int PERMISSION_REQUEST_CODE = 101;
    private static final int FILE_CHOOSER_REQUEST_CODE = 1002;

    private static final String PRODUCTION_URL = "https://miezlearning.github.io/umkm-prototype/";
    private static final String OFFLINE_FALLBACK_URL = "file:///android_asset/index.html";

    // Standard Serial Port Profile (SPP) UUID for Classic Bluetooth Thermal Printers
    private static final UUID SPP_UUID = UUID.fromString("00001101-0000-1000-8000-00805F9B34FB");

    private WebView webView;
    private BluetoothAdapter bluetoothAdapter;
    private String preferredPrinterAddress = null;

    // Persistent Bluetooth Socket & Output Stream for Instant Zero-Delay Printing
    private BluetoothSocket activeSocket = null;
    private OutputStream activeOutputStream = null;
    private String connectedDeviceAddress = null;
    private final Object socketLock = new Object();
    private final ExecutorService printExecutor = Executors.newSingleThreadExecutor();

    // Callback untuk pemilih file/gambar (HTML <input type="file">)
    private ValueCallback<Uri[]> filePathCallback;

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        webView = new WebView(this);
        setContentView(webView);

        bluetoothAdapter = BluetoothAdapter.getDefaultAdapter();

        // Background warm-up / pre-connect to thermal printer so print is 100% INSTANT with ZERO DELAY!
        printExecutor.execute(() -> {
            try {
                if (bluetoothAdapter != null && bluetoothAdapter.isEnabled()) {
                    getOrConnectPrinter();
                }
            } catch (Exception ignored) {}
        });

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setAllowFileAccess(true);
        settings.setAllowContentAccess(true);
        settings.setLoadWithOverviewMode(true);
        settings.setUseWideViewPort(true);
        settings.setMediaPlaybackRequiresUserGesture(false);

        // Cache-First with ServiceWorker support
        settings.setCacheMode(WebSettings.LOAD_DEFAULT);

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            settings.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);
        }

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                if (request != null && request.getUrl() != null) {
                    return handleExternalUrl(request.getUrl().toString());
                }
                return false;
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, String url) {
                return handleExternalUrl(url);
            }

            private boolean handleExternalUrl(String url) {
                if (url == null) return false;

                // 1. Biarkan WebView menangani halaman aplikasi sendiri (URL Cloud & Offline Fallback)
                if (url.startsWith("https://miezlearning.github.io/umkm-prototype") || 
                    url.startsWith("file:///android_asset/")) {
                    return false;
                }

                // 2. WhatsApp: arahkan langsung ke aplikasi WhatsApp native resmi
                if (url.startsWith("https://wa.me/") || 
                    url.startsWith("https://api.whatsapp.com/") || 
                    url.startsWith("whatsapp://")) {
                    try {
                        Intent waIntent = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
                        waIntent.setPackage("com.whatsapp");
                        waIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                        startActivity(waIntent);
                        return true;
                    } catch (Exception e) {
                        // Fallback jika com.whatsapp tidak ada (misal WhatsApp Business atau browser)
                        try {
                            Intent genericIntent = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
                            genericIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                            startActivity(genericIntent);
                            return true;
                        } catch (Exception err) {
                            Log.e(TAG, "Gagal membuka WhatsApp: " + url, err);
                        }
                    }
                    return true;
                }

                // 3. Telepon, SMS, Email, Peta
                if (url.startsWith("tel:") || url.startsWith("mailto:") || url.startsWith("sms:") || url.startsWith("geo:")) {
                    try {
                        Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
                        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                        startActivity(intent);
                        return true;
                    } catch (Exception e) {
                        Log.e(TAG, "Gagal membuka link aksi: " + url, e);
                    }
                    return true;
                }

                // 4. Custom Intent Android (misal intent://)
                if (url.startsWith("intent://")) {
                    try {
                        Intent intent = Intent.parseUri(url, Intent.URI_INTENT_SCHEME);
                        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                        startActivity(intent);
                        return true;
                    } catch (Exception e) {
                        Log.e(TAG, "Gagal memproses intent: " + url, e);
                    }
                    return true;
                }

                // 5. Tautan website luar lainnya -> Buka di browser eksternal Android (Chrome)
                try {
                    Intent browserIntent = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
                    browserIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                    startActivity(browserIntent);
                    return true;
                } catch (Exception e) {
                    Log.e(TAG, "Gagal membuka browser luar untuk: " + url, e);
                }

                return false;
            }

            @Override
            public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                super.onReceivedError(view, request, error);
                if (request.isForMainFrame()) {
                    Log.w(TAG, "Gagal memuat URL cloud, beralih ke aset offline internal...");
                    view.loadUrl(OFFLINE_FALLBACK_URL);
                }
            }

            @Override
            public void onReceivedError(WebView view, int errorCode, String description, String failingUrl) {
                if (failingUrl != null && failingUrl.startsWith("http")) {
                    Log.w(TAG, "Gagal koneksi internet (" + description + "), muat fallback offline.");
                    view.loadUrl(OFFLINE_FALLBACK_URL);
                }
            }
        });

        // WebChromeClient dengan dukungan Upload Gambar & Kamera
        webView.setWebChromeClient(new WebChromeClient() {

            // 1. Dukungan Upload Gambar / File (<input type="file">)
            @Override
            public boolean onShowFileChooser(WebView webView, ValueCallback<Uri[]> filePathCallback, FileChooserParams fileChooserParams) {
                if (MainActivity.this.filePathCallback != null) {
                    MainActivity.this.filePathCallback.onReceiveValue(null);
                    MainActivity.this.filePathCallback = null;
                }

                MainActivity.this.filePathCallback = filePathCallback;

                Intent intent = new Intent(Intent.ACTION_GET_CONTENT);
                intent.addCategory(Intent.CATEGORY_OPENABLE);
                intent.setType("image/*");

                try {
                    startActivityForResult(Intent.createChooser(intent, "Pilih Gambar Logo Struk"), FILE_CHOOSER_REQUEST_CODE);
                    return true;
                } catch (Exception e) {
                    MainActivity.this.filePathCallback = null;
                    Toast.makeText(MainActivity.this, "Tidak dapat membuka galeri: " + e.getMessage(), Toast.LENGTH_SHORT).show();
                    return false;
                }
            }

            // 2. Izin Kamera Web untuk Scan QRIS & Barcode Scanner
            @Override
            public void onPermissionRequest(final PermissionRequest request) {
                MainActivity.this.runOnUiThread(() -> {
                    request.grant(request.getResources());
                });
            }

            // 3. Izin Lokasi jika diminta
            @Override
            public void onGeolocationPermissionsShowPrompt(String origin, GeolocationPermissions.Callback callback) {
                callback.invoke(origin, true, false);
            }

            // 4. Alert bawaan JavaScript
            @Override
            public boolean onJsAlert(WebView view, String url, String message, JsResult result) {
                new AlertDialog.Builder(MainActivity.this)
                        .setTitle("Aristotle POS")
                        .setMessage(message)
                        .setPositiveButton("OK", (dialog, which) -> result.confirm())
                        .setCancelable(false)
                        .show();
                return true;
            }

            // 5. Confirm bawaan JavaScript
            @Override
            public boolean onJsConfirm(WebView view, String url, String message, JsResult result) {
                new AlertDialog.Builder(MainActivity.this)
                        .setTitle("Konfirmasi")
                        .setMessage(message)
                        .setPositiveButton("Ya", (dialog, which) -> result.confirm())
                        .setNegativeButton("Batal", (dialog, which) -> result.cancel())
                        .setCancelable(false)
                        .show();
                return true;
            }
        });

        // Injeksi Native JavaScript Bridge untuk cetak dan laci kasir
        webView.addJavascriptInterface(new AndroidBridge(), "AndroidBridge");

        checkAndRequestPermissions();

        // Muat URL Cloud untuk update instan tanpa perlu install ulang APK.
        // Jika offline, otomatis fallback ke aset internal!
        webView.loadUrl(PRODUCTION_URL);
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, @Nullable Intent data) {
        super.onActivityResult(requestCode, resultCode, data);

        if (requestCode == FILE_CHOOSER_REQUEST_CODE) {
            if (filePathCallback != null) {
                Uri[] results = null;
                if (resultCode == RESULT_OK && data != null) {
                    if (data.getData() != null) {
                        results = new Uri[]{data.getData()};
                    } else if (data.getClipData() != null) {
                        int count = data.getClipData().getItemCount();
                        results = new Uri[count];
                        for (int i = 0; i < count; i++) {
                            results[i] = data.getClipData().getItemAt(i).getUri();
                        }
                    }
                }
                filePathCallback.onReceiveValue(results);
                filePathCallback = null;
            }
        }
    }

    private void checkAndRequestPermissions() {
        List<String> permissionsNeeded = new ArrayList<>();

        // Izin Kamera
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA) != PackageManager.PERMISSION_GRANTED) {
            permissionsNeeded.add(Manifest.permission.CAMERA);
        }

        // Izin Bluetooth Android 12+
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.BLUETOOTH_CONNECT) != PackageManager.PERMISSION_GRANTED) {
                permissionsNeeded.add(Manifest.permission.BLUETOOTH_CONNECT);
            }
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.BLUETOOTH_SCAN) != PackageManager.PERMISSION_GRANTED) {
                permissionsNeeded.add(Manifest.permission.BLUETOOTH_SCAN);
            }
        } else {
            // Android 11 ke bawah
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION) != PackageManager.PERMISSION_GRANTED) {
                permissionsNeeded.add(Manifest.permission.ACCESS_FINE_LOCATION);
            }
        }

        // Izin Galeri / Memori
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.READ_MEDIA_IMAGES) != PackageManager.PERMISSION_GRANTED) {
                permissionsNeeded.add(Manifest.permission.READ_MEDIA_IMAGES);
            }
        } else {
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.READ_EXTERNAL_STORAGE) != PackageManager.PERMISSION_GRANTED) {
                permissionsNeeded.add(Manifest.permission.READ_EXTERNAL_STORAGE);
            }
        }

        if (!permissionsNeeded.isEmpty()) {
            ActivityCompat.requestPermissions(this, permissionsNeeded.toArray(new String[0]), PERMISSION_REQUEST_CODE);
        }
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, @NonNull String[] permissions, @NonNull int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode == PERMISSION_REQUEST_CODE) {
            boolean allGranted = true;
            for (int res : grantResults) {
                if (res != PackageManager.PERMISSION_GRANTED) {
                    allGranted = false;
                    break;
                }
            }
            if (allGranted) {
                Log.d(TAG, "Semua izin sistem telah disetujui pengguna.");
            }
        }
    }

    @Override
    public void onBackPressed() {
        if (webView.canGoBack()) {
            webView.goBack();
        } else {
            super.onBackPressed();
        }
    }

    /**
     * Native JavaScript Interface exposed to frontend Web App via `window.AndroidBridge`
     */
    public class AndroidBridge {

        @JavascriptInterface
        public boolean isNativeApp() {
            return true;
        }

        @JavascriptInterface
        public String getAppVersion() {
            return "1.1.3 (Aristotle POS)";
        }

        @JavascriptInterface
        public int getAppVersionCode() {
            try {
                PackageInfo pInfo = getPackageManager().getPackageInfo(getPackageName(), 0);
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                    return (int) pInfo.getLongVersionCode();
                } else {
                    return pInfo.versionCode;
                }
            } catch (Exception e) {
                return 5;
            }
        }

        @JavascriptInterface
        public String getAppVersionName() {
            try {
                PackageInfo pInfo = getPackageManager().getPackageInfo(getPackageName(), 0);
                return pInfo.versionName;
            } catch (Exception e) {
                return "1.1.3";
            }
        }

        @JavascriptInterface
        public void downloadAndInstallApk(final String downloadUrl) {
            MainActivity.this.startApkDownloadAndInstall(downloadUrl);
        }

        @JavascriptInterface
        public String getPairedDevices() {
            JSONArray arr = new JSONArray();
            if (bluetoothAdapter == null || !bluetoothAdapter.isEnabled()) {
                return arr.toString();
            }

            try {
                Set<BluetoothDevice> pairedDevices = bluetoothAdapter.getBondedDevices();
                if (pairedDevices != null) {
                    for (BluetoothDevice device : pairedDevices) {
                        JSONObject obj = new JSONObject();
                        obj.put("name", device.getName());
                        obj.put("address", device.getAddress());
                        arr.put(obj);
                    }
                }
            } catch (SecurityException se) {
                Log.e(TAG, "Izin Bluetooth ditolak: " + se.getMessage());
            } catch (Exception e) {
                Log.e(TAG, "Error getPairedDevices: " + e.getMessage());
            }
            return arr.toString();
        }

        @JavascriptInterface
        public void setPreferredPrinter(String address) {
            preferredPrinterAddress = address;
        }

        @JavascriptInterface
        public boolean printBluetooth(String base64Data) {
            if (base64Data == null || base64Data.isEmpty()) return false;
            byte[] bytes = Base64.decode(base64Data, Base64.DEFAULT);
            return sendRawBytesToPrinter(bytes);
        }

        @JavascriptInterface
        public boolean kickDrawer() {
            // High energy cash drawer kick pulse: Pin 2 & Pin 5
            byte[] drawerPulse = new byte[] {
                0x1B, 0x70, 0x00, 0x32, (byte) 0xFA,
                0x1B, 0x70, 0x01, 0x32, (byte) 0xFA,
                0x07
            };
            return sendRawBytesToPrinter(drawerPulse);
        }

        private boolean sendRawBytesToPrinter(byte[] data) {
            return MainActivity.this.sendRawBytesToPrinter(data);
        }

        private void showToastOnUI(final String msg) {
            runOnUiThread(() -> Toast.makeText(MainActivity.this, msg, Toast.LENGTH_SHORT).show());
        }
    }

    private OutputStream getOrConnectPrinter() throws IOException {
        synchronized (socketLock) {
            // 1. Jika socket sudah aktif terhubung, gunakan langsung (ZERO DELAY!)
            if (activeSocket != null && activeSocket.isConnected() && activeOutputStream != null) {
                if (preferredPrinterAddress == null || preferredPrinterAddress.equalsIgnoreCase(connectedDeviceAddress)) {
                    return activeOutputStream;
                }
            }

            closeActiveSocket();

            if (bluetoothAdapter == null || !bluetoothAdapter.isEnabled()) {
                throw new IOException("Bluetooth adapter mati atau tidak tersedia.");
            }

            Set<BluetoothDevice> pairedDevices = bluetoothAdapter.getBondedDevices();
            if (pairedDevices == null || pairedDevices.isEmpty()) {
                throw new IOException("Belum ada printer Bluetooth yang di-pair di HP.");
            }

            BluetoothDevice targetDevice = null;
            for (BluetoothDevice dev : pairedDevices) {
                String name = dev.getName();
                String addr = dev.getAddress();
                if (preferredPrinterAddress != null && preferredPrinterAddress.equalsIgnoreCase(addr)) {
                    targetDevice = dev;
                    break;
                }
                if (name != null) {
                    String lower = name.toLowerCase();
                    if (lower.contains("rpp02") || lower.contains("vsc") || lower.contains("pos") ||
                        lower.contains("thermal") || lower.contains("58") || lower.contains("printer") ||
                        lower.contains("mpt") || lower.contains("zj")) {
                        targetDevice = dev;
                        break;
                    }
                }
            }

            if (targetDevice == null) {
                targetDevice = pairedDevices.iterator().next();
            }

            Log.d(TAG, "Membuka koneksi persistent Bluetooth ke: " + targetDevice.getName());
            bluetoothAdapter.cancelDiscovery();

            BluetoothSocket socket = targetDevice.createRfcommSocketToServiceRecord(SPP_UUID);
            socket.connect();

            activeSocket = socket;
            activeOutputStream = socket.getOutputStream();
            connectedDeviceAddress = targetDevice.getAddress();
            Log.d(TAG, "Koneksi Bluetooth aktif dan standby (Zero Delay Ready)!");

            return activeOutputStream;
        }
    }

    private void closeActiveSocket() {
        synchronized (socketLock) {
            if (activeOutputStream != null) {
                try { activeOutputStream.close(); } catch (Exception ignored) {}
                activeOutputStream = null;
            }
            if (activeSocket != null) {
                try { activeSocket.close(); } catch (Exception ignored) {}
                activeSocket = null;
            }
            connectedDeviceAddress = null;
        }
    }

    private boolean sendRawBytesToPrinter(byte[] data) {
        if (bluetoothAdapter == null) {
            runOnUiThread(() -> Toast.makeText(this, "Perangkat tidak memiliki adapter Bluetooth.", Toast.LENGTH_SHORT).show());
            return false;
        }
        if (!bluetoothAdapter.isEnabled()) {
            runOnUiThread(() -> Toast.makeText(this, "Bluetooth HP sedang mati. Mohon nyalakan Bluetooth.", Toast.LENGTH_SHORT).show());
            return false;
        }

        try {
            // Gunakan socket persistent (Zero Delay) dengan chunking proteksi buffer
            OutputStream out = getOrConnectPrinter();
            writeDataChunked(out, data);
            Log.d(TAG, "Semua " + data.length + " bytes berhasil dikirim ke printer secara tuntas!");
            return true;
        } catch (IOException e) {
            Log.w(TAG, "Socket terputus, mencoba auto-reconnect: " + e.getMessage());
            closeActiveSocket();
            try {
                OutputStream freshOut = getOrConnectPrinter();
                writeDataChunked(freshOut, data);
                Log.d(TAG, "Data terkirim tuntas setelah auto-reconnect!");
                return true;
            } catch (Exception retryErr) {
                Log.e(TAG, "Gagal koneksi printer: " + retryErr.getMessage());
                runOnUiThread(() -> Toast.makeText(this, "Gagal menghubungkan ke printer: " + retryErr.getMessage(), Toast.LENGTH_SHORT).show());
                return false;
            }
        } catch (SecurityException se) {
            Log.e(TAG, "Izin Bluetooth ditolak: " + se.getMessage());
            runOnUiThread(() -> Toast.makeText(this, "Izin Bluetooth belum diberikan di Pengaturan Aplikasi.", Toast.LENGTH_SHORT).show());
            return false;
        }
    }

    private void writeDataChunked(OutputStream out, byte[] data) throws IOException {
        int chunkSize = 256;
        for (int i = 0; i < data.length; i += chunkSize) {
            int len = Math.min(chunkSize, data.length - i);
            out.write(data, i, len);
            out.flush();
            if (i + chunkSize < data.length) {
                try {
                    Thread.sleep(25); // Pacing 25ms agar mikrokontroler printer thermal VSC tidak overflow
                } catch (InterruptedException ignored) {}
            }
        }
        try { Thread.sleep(50); } catch (InterruptedException ignored) {}
    }

    public void startApkDownloadAndInstall(final String downloadUrl) {
        new Thread(new Runnable() {
            @Override
            public void run() {
                InputStream input = null;
                OutputStream output = null;
                HttpURLConnection connection = null;
                try {
                    URL url = new URL(downloadUrl);
                    connection = (HttpURLConnection) url.openConnection();
                    connection.setConnectTimeout(15000);
                    connection.setReadTimeout(30000);
                    connection.setInstanceFollowRedirects(true);
                    connection.connect();

                    // Tangani redirect jika ada (misal GitHub Releases 302 redirect ke AWS S3)
                    int status = connection.getResponseCode();
                    if (status == HttpURLConnection.HTTP_MOVED_TEMP || status == HttpURLConnection.HTTP_MOVED_PERM || status == 307 || status == 308) {
                        String newUrl = connection.getHeaderField("Location");
                        connection.disconnect();
                        url = new URL(newUrl);
                        connection = (HttpURLConnection) url.openConnection();
                        connection.setConnectTimeout(15000);
                        connection.setReadTimeout(30000);
                        connection.connect();
                    }

                    if (connection.getResponseCode() != HttpURLConnection.HTTP_OK) {
                        notifyUpdateError("Gagal mengunduh (HTTP " + connection.getResponseCode() + ")");
                        return;
                    }

                    int fileLength = connection.getContentLength();
                    File cacheDir = getExternalCacheDir() != null ? getExternalCacheDir() : getCacheDir();
                    final File apkFile = new File(cacheDir, "Aristotle-POS-update.apk");
                    if (apkFile.exists()) {
                        apkFile.delete();
                    }

                    input = connection.getInputStream();
                    output = new FileOutputStream(apkFile);

                    byte[] data = new byte[8192];
                    long total = 0;
                    int count;
                    long lastReportTime = 0;

                    while ((count = input.read(data)) != -1) {
                        total += count;
                        output.write(data, 0, count);

                        long now = System.currentTimeMillis();
                        if (fileLength > 0 && (now - lastReportTime > 250)) {
                            lastReportTime = now;
                            final int progress = (int) ((total * 100) / fileLength);
                            runOnUiThread(new Runnable() {
                                @Override
                                public void run() {
                                    if (webView != null) {
                                        webView.evaluateJavascript("window.KasirApp && window.KasirApp.onUpdateDownloadProgress && window.KasirApp.onUpdateDownloadProgress(" + progress + ");", null);
                                    }
                                }
                            });
                        }
                    }

                    output.flush();

                    runOnUiThread(new Runnable() {
                        @Override
                        public void run() {
                            if (webView != null) {
                                webView.evaluateJavascript("window.KasirApp && window.KasirApp.onUpdateDownloadProgress && window.KasirApp.onUpdateDownloadProgress(100);", null);
                            }
                            installDownloadedApk(apkFile);
                        }
                    });

                } catch (final Exception e) {
                    Log.e(TAG, "Download error: " + e.getMessage(), e);
                    notifyUpdateError(e.getMessage() != null ? e.getMessage() : "Koneksi terputus saat mengunduh");
                } finally {
                    try { if (output != null) output.close(); } catch (Exception ignored) {}
                    try { if (input != null) input.close(); } catch (Exception ignored) {}
                    if (connection != null) connection.disconnect();
                }
            }
        }).start();
    }

    private void notifyUpdateError(final String msg) {
        runOnUiThread(new Runnable() {
            @Override
            public void run() {
                if (webView != null) {
                    webView.evaluateJavascript("window.KasirApp && window.KasirApp.onUpdateDownloadError && window.KasirApp.onUpdateDownloadError('" + msg.replace("'", "\\'") + "');", null);
                }
                Toast.makeText(MainActivity.this, "Gagal mengunduh pembaruan: " + msg, Toast.LENGTH_LONG).show();
            }
        });
    }

    private void installDownloadedApk(File apkFile) {
        try {
            if (!apkFile.exists()) {
                notifyUpdateError("File APK tidak ditemukan.");
                return;
            }

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                if (!getPackageManager().canRequestPackageInstalls()) {
                    Toast.makeText(this, "Izinkan Aristotle POS memasang aplikasi agar pembaruan dapat dipasang.", Toast.LENGTH_LONG).show();
                    Intent permissionIntent = new Intent(android.provider.Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES);
                    permissionIntent.setData(Uri.parse("package:" + getPackageName()));
                    startActivity(permissionIntent);
                    return;
                }
            }

            Uri apkUri = androidx.core.content.FileProvider.getUriForFile(this, getPackageName() + ".fileprovider", apkFile);
            Intent intent = new Intent(Intent.ACTION_VIEW);
            intent.setDataAndType(apkUri, "application/vnd.android.package-archive");
            intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            startActivity(intent);
        } catch (Exception e) {
            Log.e(TAG, "Install error: " + e.getMessage(), e);
            notifyUpdateError("Gagal membuka installer: " + e.getMessage());
        }
    }

    @Override
    protected void onDestroy() {
        super.onDestroy();
        closeActiveSocket();
        printExecutor.shutdown();
    }
}
