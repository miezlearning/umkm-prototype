# Changelog - Aristotle POS

Semua perubahan besar dan pembaruan fitur pada **Aristotle POS** (Multi-Tenant SaaS POS System) didokumentasikan dalam file ini.

Format dokumen ini mengacu pada panduan [Keep a Changelog](https://keepachangelog.com/id/1.0.0/) dan mematuhi aturan [Semantic Versioning](https://semver.org/).

---

## [v1.1.19] - 2026-09-03

### 🛠️ Perbaikan & Peningkatan Laci Kasir (Cash Drawer)
- **Universal Multi-Pin Solenoid Pulse:** Mengirim kombinasi pulsa energi tinggi ESC/POS Pin 2 (`ESC p 0`), Pin 5 (`ESC p 1`), real-time `DLE DC4`, dan karakter LF buffer flush untuk memastikan kompatibilitas 100% dengan berbagai printer thermal (VSC TM-58V, Epson, Xprinter, Kassen, Panda, dll).
- **Pemisahan Pemicu Buka Laci Otomatis:** Memastikan laci kasir selalu otomatis terbuka saat pembayaran tunai selesai meskipun opsi cetak struk otomatis (`autoPrint`) dinonaktifkan.
- **Pencegahan Buffer Reset:** Memindahkan injeksi perintah buka laci pada struk ke bagian paling akhir setelah feed kertas, mencegah pembatalan denyut solenoid akibat perintah inisialisasi logo (`ESC @`).
- **Peningkatan Uji Coba Laci Antar-Perangkat:** Tombol "Buka Laci" pada Pengaturan Printer kini mendukung Cloud Relay jika ditekan dari HP Pelayan / Device 2.

---

## [v1.1.18] - 2026-09-03

### 🚀 Fitur Baru & Peningkatan UI/UX (Added & Improved)
- **Redesain Header Bar Mobile Ramah Layar Sempit:** Identitas toko di layar ponsel (< 640px) diubah menjadi tombol ikon brand/avatar toko yang bersih dengan indikator real-time sinkronisasi cloud hijau berdenyut, mengeliminasi teks bertumpuk/mepet dengan tombol printer dan aksi lainnya.
- **Pop-up Profil Toko Komprehensif:** Seluruh detail toko, status sinkronisasi, link bagi kasir ke HP lain via WhatsApp, konfigurasi PIN owner, versi aplikasi, dan tombol logout dapat diakses secara instan saat tombol ikon toko diklik.

### 🛠️ Perbaikan Bug (Fixed)
- **Sinkronisasi Pesanan Multi-Device Realtime:** Memperbaiki bug pada callback `queues` di mana `pos.renderProducts()` sebelumnya terlewat, sehingga kartu produk di Device 2 kini otomatis memperbarui badge kuantitas dan highlight hijau seketika saat pesanan diubah di Device 1.
- **Pencegahan Pembayaran Ganda:** Otomatis menutup modal pembayaran di perangkat lain dengan notifikasi ramah jika pesanan telah diselesaikan atau dikosongkan secara remote.
- **Konsistensi Navigasi:** Memastikan tab antrian pesanan dirender ulang saat berpindah ke tampilan kasir.

---

## [v1.1.5] - 2026-09-03

### 🚀 Fitur Baru (Added)
- **Multi-Device Cloud Print & Cash Drawer Relay:** Perangkat sekunder (Device 2 / HP Pelayan / Owner) otomatis dapat mencetak struk, tiket dapur, dan membuka laci kasir melalui perangkat utama (Device 1) yang sedang terhubung ke printer thermal fisik.
- **Antrean Tugas Cetak Realtime Firestore (`print_jobs`):** Komunikasi sub-detik antar-perangkat toko UMKM dengan auto-cleanup tugas lama tanpa perlu konfigurasi IP/jaringan manual (Zero Configuration).
- **Self-Hosted Material Symbols Font:** Font icon `Material Symbols Rounded` (.woff2) disimpan lokal di repo dan bundle aset APK Android, memberikan waktu muat 0ms dan 100% tahan offline.
- **Pipeline Splash Screen Riil (Real Asset Readiness):** Splash screen kini memproses tahapan aset sebenarnya (0% - 100%) dan menunggu `document.fonts.ready` sebelum ditutup.
- **Proteksi CSS Anti-FOUT:** Mencegah kedipan teks mentah (*Flash of Unstyled Text*) seperti tulisan `point_of_sale` atau `inventory_2` sebelum font aktif.

### 🛠️ Perbaikan Bug (Fixed)
- **Blind Hardcoded Timer Dihapus:** Mengganti timer buta `setTimeout` di splash screen dengan pengawas jaringan dinamis (*safety watchdog*).
- **Service Worker Font Caching:** Memperbaiki aturan filter `sw.js` agar font Google / lokal dapat tersimpan di Cache Storage PWA.

---

## [v1.1.4] - 2026-09-03

### 🚀 Fitur Baru (Added)
- **Fitur Tiket Dapur / Kitchen Checkpoint Resmi:** Format cetak khusus dapur dan bar pemisahan pos pesanan.
- **Pembaruan Langsung dari Dalam Aplikasi (In-App Auto-Updater):** Notifikasi dan pengunduh file APK langsung dari modal info toko.
- **Perbaikan Mode Teks Printer VSC TM-58V:** Normalisasi ASCII dan mitigasi string encoding thermal printer.

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
