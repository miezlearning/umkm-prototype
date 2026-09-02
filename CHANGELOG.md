# Changelog - Aristotle POS

Semua perubahan besar dan pembaruan fitur pada **Aristotle POS** (Multi-Tenant SaaS POS System) didokumentasikan dalam file ini.

Format dokumen ini mengacu pada panduan [Keep a Changelog](https://keepachangelog.com/id/1.0.0/) dan mematuhi aturan [Semantic Versioning](https://semver.org/).

---

## [v1.1.0] - 2026-09-02

### 🚀 Fitur Baru (Added)
- **Native Android Bluetooth SPP Bridge:** Komunikasi langsung via RFCOMM socket (`00001101-0000-1000-8000-00805F9B34FB`) ke printer thermal Bluetooth VSC TM-58V (`RPP02N`) dan sejenisnya.
- **Bypass Total Aplikasi Pihak Ketiga:** Mencetak struk secara instan tanpa memerlukan RawBT atau aplikasi perantara lainnya.
- **0% Watermark:** Struk kasir murni 100% bebas watermark atau teks promosi pihak ketiga.
- **Auto-Kick Cash Drawer:** Pengiriman denyut pulsa listrik solenoid secara native (*dual pulse* Pin 2 & Pin 5) untuk membuka laci kasir secara otomatis saat pembayaran tunai selesai.
- **Pemilih Foto Galeri Native (`WebChromeClient.onShowFileChooser`):** Mendukung unggah logo toko untuk struk langsung dari galeri HP atau kamera.
- **Izin Kamera & Sensor Native:** Integrasi izin kamera sistem Android untuk fitur pemindai QRIS & barcode (*jsQR*).
- **Over-The-Air (OTA) Cloud Live Updates:** Sistem Hybrid WebView yang memuat versi cloud terbaru secara otomatis setiap kali ada `git push`, sehingga mitra UMKM tidak perlu menginstal ulang file APK jika ada update fitur.
- **Penyimpanan Offline Tangguh:** Dukungan Service Worker PWA (`sw.js`) dan Cache Storage internal jika kedai kasir sedang tidak memiliki koneksi internet.
- **GitHub Actions CI/CD Pipeline:** Otomatisasi deploy ke GitHub Pages dan kompilasi build APK cloud setiap kali ada push ke branch `master`.

### 🛠️ Perbaikan Bug (Fixed)
- **Modal Ubah Nama Pesanan / Meja di HP:** Menambahkan antarmuka `#renameQueueModal` yang ramah sentuhan, lengkap dengan tombol cepat (*Quick Presets*: Meja 1-4, Bungkus, GoFood, GrabFood).
- **Tombol Ubah Nama Instan:** Menyematkan ikon pensil (✏️) langsung pada tab antrian aktif di layar katalog kasir HP.
- **Auto-Reset Nama Antrian Tunggal:** Memperbaiki logika pembayaran kasir sehingga jika hanya ada satu antrian tersisa, namanya otomatis kembali ke default `"Pesanan #1"` setelah pembayaran selesai (tidak lagi tertinggal nama pelanggan sebelumnya).
- **Perbaikan CSS Cetak (@media print):** Memperbaiki aturan `@media print` agar struk kasir tidak lagi tercetak sebagai kertas putih kosong pada browser desktop/laptop.
- **Sinkronisasi Multi-Device Cloud Firestore:** Pengaturan printer, logo toko, dan identitas struk kini otomatis tersinkronisasi antar perangkat secara realtime.

---

## [v1.0.0] - 2026-08-15

### 🚀 Peluncuran Awal (Initial Release)
- Sistem Kasir Point-of-Sale (POS) ramah lansia dengan tipografi kontras tinggi (*Forest Emerald & Warm Stone*).
- Multi-antrian pesanan dinamis (*Multi-Order Tabs*).
- Fitur pembayaran Tunai (dengan kalkulator kembalian & quick-cash chips) dan QRIS Dinamis.
- Pembukuan keuangan harian: laporan laba kotor, omset, dan pencatatan pengeluaran harian.
- Cadangkan data (*Backup & Restore*) berbasis file JSON lokal.
- Sinkronisasi Cloud Firestore multi-toko.
