# Changelog - Aristotle POS

Semua perubahan besar dan pembaruan fitur pada **Aristotle POS** (Multi-Tenant SaaS POS System) didokumentasikan dalam file ini.

Format dokumen ini mengacu pada panduan [Keep a Changelog](https://keepachangelog.com/id/1.0.0/) dan mematuhi aturan [Semantic Versioning](https://semver.org/).

## [v1.1.30] - 2026-09-04

### 📷 Sistem Pairing QR Code Instan (Zero-Config Kasir ➔ Pelayan)
- **Tampilan QR Sambungan di Kasir Utama:** Tombol baru *"📱 QR Sambungkan HP Pelayan"* di profil toko dan pengaturan printer. Menghasilkan kode QR presisi tinggi yang memuat kredensial toko, role client, dan konfigurasi IP kasir dalam satu sentuhan.
- **Live Camera Scanner di HP Pelayan:** Fitur pemindai kamera langsung terintegrasi (*jsQR*) lengkap dengan bidik beranimasi (*laser glow effect*) dan fallback unggah gambar dari galeri. Pelayan cukup mengarahkan kamera ke layar Kasir Utama untuk otomatis login, mengatur peran ke pelayan, dan langsung terhubung.
- **Pairing 1-Sentuh di Layar Masuk:** Tombol scan QR juga disematkan di halaman login toko, sehingga karyawan/pelayan baru tidak perlu mengetik nama toko, ID toko, atau alamat IP sama sekali.

---

## [v1.1.29] - 2026-09-04

### 🐛 Perbaikan Impor `escapeHtml` pada Modul Printer
- **Resolusi ReferenceError `escapeHtml`:** Menambahkan impor fungsi sanitasi HTML `escapeHtml` dari `../utils.js` ke dalam `js/modules/printer.js`. Memperbaiki galat `escapeHtml is not defined` saat mencetak struk tes, preview struk belanja, dan perenderan status badge printer.

---

## [v1.1.28] - 2026-09-03

### ⚡ Eliminasi Status Menguji IP Menggantung & Tombol Tes Cetak Instan
- **Anti-Hang Strict Timeout (Promise.race 1.2s):** Seluruh pengujian ping dan deteksi otomatis IP lokal kini dibungkus dengan `Promise.race` berbatas waktu ketat 1.2 detik. Status tidak akan pernah menggantung pada tulisan "Menguji IP...", dan secara otomatis langsung beralih ke Cloud Relay yang siap pakai.
- **Tombol Tes Cetak Kasir Terbuka (`🖨️ Tes Cetak ke Kasir Sekarang`):** Menampilkan tombol tes cetak yang jelas dan langsung memicu uji cetak struk dari HP Pelayan ke HP Kasir Utama melalui Cloud Relay dalam waktu <1 detik.
- **Panduan Praktis Wi-Fi Router vs Hotspot HP:** Menambahkan edukasi tips bahwa untuk mencetak 100% offline tanpa internet bebas blokir router (AP Isolation), cukup nyalakan Hotspot tethering langsung dari HP Kasir.

---

## [v1.1.27] - 2026-09-03

### 🔧 Perbaikan Input Alamat IP & Kejelasan Mode Cetak
- **Proteksi Ketikan Input IP Manual:** Memperbaiki bug agresif di mana isi kolom input alamat IP kasir terhapus secara otomatis saat pengguna baru mengetik 3 digit pertama (`192`). Sekarang input diproteksi penuh dan langsung disimpan secara realtime ke state/localStorage pada setiap ketikan (`oninput`).
- **Sinkronisasi Host Otomatis via Cloud Presence:** Kasir Utama di APK Android kini otomatis mempublikasikan alamat IP lokalnya ke Cloud Firestore. HP Pelayan yang berada di satu router Wi-Fi langsung mendeteksi dan terhubung ke IP kasir tanpa perlu menebak atau mencari manual.
- **Kejelasan Arsitektur Cetak Web Browser vs Android APK:** Menambahkan deteksi dan keterangan visual yang transparan jika Kasir dibuka di Web Browser (jalur cetak menggunakan Cloud Relay) dibandingkan jika dibuka di Android APK (jalur server offline port 8088).

---

## [v1.1.26] - 2026-09-03

### 🍳 Kategori Topping & Ekstra Ramah Lansia (Senior-Friendly Add-Ons)
- **Kategori Khusus "Topping & Ekstra":** Menyediakan kategori menu mandiri untuk add-on fisik berbayar (Nasi Tambah, Telur Dadar/Ceplok, Ekstra Sambal, Keju Parut, Es Batu Ekstra) tanpa memunculkan modal pop-up bertingkat yang membingungkan kasir lansia atau pemula.
- **Catatan Cepat 1-Sentuh (Quick Note Chips):** Kasir/pelayan dapat menambahkan instruksi khusus pada item keranjang (`🔥 Pedas`, `🌶️ Sedang`, `🍃 Tidak Pedas`, `🧅 Tanpa Bawang`, `🥣 Pisah Sambal`, `🧊 Es Sedikit`, `🧂 Kurang Manis`, `🥡 Bungkus`) hanya dengan sekali sentuh tanpa perlu mengetik di keyboard HP.
- **Pencetakan Otomatis Catatan Pesanan:** Catatan instruksi item otomatis tercetak di bawah nama produk pada struk pembayaran pelanggan maupun tiket pesanan dapur thermal ESC/POS.

### 🌐 Mode Hybrid Cetak Offline LAN/Hotspot (Zero Internet Requirement)
- **Embedded Local HTTP Server (Port 8088):** Host Kasir Utama (Device 1) yang berjalan di APK Android kini otomatis menjalankan server HTTP lokal ringan (`ServerSocket`).
- **Pencetakan Langsung Tanpa Kuota:** HP Pelayan (Device 2) yang berada di satu jaringan Wi-Fi atau Hotspot HP yang sama dapat mencetak tiket struk & dapur langsung dalam ~50ms tanpa memerlukan koneksi internet aktif.
- **Fallback Cerdas Otomatis:** Jika perangkat pelayan berada di luar jangkauan Wi-Fi lokal, sistem secara otomatis dan senyap mengalihkan jalur pencetakan ke Firebase Cloud Relay.

---

## [v1.1.25] - 2026-09-03

### 🛡️ Eliminasi Teks Ikon Mentah & Penghentian Loading Gimmick (Fixed FOUT)
- **Anti-FOUT Strict Containment:** Mengunci dimensi dan membendung teks ligature mentah (`width: 1em; height: 1em; overflow: hidden; flex-shrink: 0;`) sehingga kata panjang seperti `system_update` dan `cloud_download` tidak akan pernah meluap atau menabrak teks tombol saat font sedang dimuat.
- **Pemuatan Aset Riil (No Fake Timeout):** Menghapus batasan timeout 2 detik palsu pada splash screen. Sistem kini benar-benar menunggu konfirmasi `document.fonts.ready` sebelum melepaskan layar loading dan sebelum menampilkan modal update.
- **Prioritas Font Lokal Ringan:** Mengarahkan `@font-face` untuk memuat font core lokal (455 KB) terlebih dahulu dibandingkan font raksasa (5.3 MB), mempercepat render ikon hingga 12x lipat.

---

## [v1.1.24] - 2026-09-03

### 🔄 Fitur Swipe Down to Refresh (Pull-to-Refresh)
- **Native Touch Pull-to-Refresh:** Menambahkan gestur tarik ke bawah (*swipe down*) di bagian atas layar untuk memuat ulang data secara instan di Web, PWA, dan APK Android. Dilengkapi indikator lingkaran Material Design 3 yang berputar mulus, efek haptic vibration saat batas tarikan tercapai, dan proteksi agar tidak terpicu saat modal sedang terbuka.

---

## [v1.1.23] - 2026-09-03

### ⚡ Eliminasi Pergerakan Kertas Saat Buka Laci Kasir (Fixed Logic)
- **Murni Pulsa Elektrik Solenoid RJ11:** Menghapus byte `Line Feed` (`0x0A`) dan `BEL` (`0x07`) dari paket perintah buka laci kasir (`buildOpenDrawerBytes` dan `MainActivity.java`). Perintah buka laci kini murni mengirimkan pulsa solenoid `ESC p` (Pin 2 dan Pin 5) dan `DLE DC4` tanpa memutar motor stepper roller kertas printer thermal sama sekali. Kertas tidak akan bergerak atau keluar sia-sia saat membuka laci kasir.

---

## [v1.1.22] - 2026-09-03

### 🧾 Sinkronisasi Pratinjau Struk Realtime (Fixed & Synced)
- **Live Thermal Receipt Preview:** Merombak pratinjau struk di modal Pengaturan Printer & Struk dari teks mentah `<pre>` monospace menjadi kartu struk kertas thermal nyata yang 100% identik dengan struk transaksi asli (`#printArea`). Menampilkan logo toko riil secara instan saat diunggah, teks header toko, daftar produk contoh, subtotal, catatan kaki, hingga banner nomor antrian besar secara interaktif dan realtime sesuai ketikan pengguna.

---

## [v1.1.21] - 2026-09-03

### 🎨 Pembaruan Desain Material Design 3 (UI/UX Overhaul)
- **Top App Bar Google Material Design 3:** Menghilangkan elemen visual "AI slop" (badge bertumpuk dan rentetan titik pemisah) pada header desktop/tablet. Digantikan dengan hierarki brand yang bersih, **M3 Tonal Filter Chip** (`[ 🟢 Kedai Usaha Mami ▾ ]`) untuk pemilih toko/antrian, dan **M3 Assist Chip** (`[ ☁️ Cloud Relay ]`) untuk status perangkat dan printer.

---

## [v1.1.20] - 2026-09-03

### 🛠️ Perbaikan Sinkronisasi Real-Time (Fixed & Optimized)
- **Single Source of Truth Kartu Menu (`renderCart -> renderProducts`):** Memastikan kartu menu produk dan badge kuantitas (`1x`, `3x`) selalu otomatis tersinkronisasi 100% setiap kali isi keranjang diperbarui dari perangkat kasir manapun.
- **Invalidasi Cache Service Worker & Auto-Refresh:** Memperbarui cache Service Worker (`aristotle-pos-v24`) dan menambahkan auto-reload saat Service Worker baru aktif agar browser pengguna di versi web selalu mengeksekusi kode JavaScript paling mutakhir tanpa perlu membersihkan cache secara manual.

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
