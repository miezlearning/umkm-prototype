# 🎓 Aristotle POS v1.1.3 — Kitchen Checkpoint & Thermal Stability Release 🚀

Selamat datang di pembaruan resmi **Aristotle POS v1.1.3**! Rilis ini membawa inovasi operasional besar untuk restoran, kafe, dan warung makan: **Sistem Tiket Dapur (Kitchen Ticket Checkpoint)** terpadu, pemulihan mode teks printer thermal VSC, dan otomatisasi cetak ganda.

---

### 🍳 1. Struk Dapur / Kitchen Checkpoint Resmi (Koki & Barista Friendly)
* **Checklist `[  ]` per Menu:** Lembar antrian khusus tim dapur lengkap dengan kotak centang di setiap menu. Koki tinggal mencentang menu yang sudah matang di piring.
* **Bebas Distraksi Harga (No Price):** Menghilangkan seluruh nominal rupiah di lembar dapur agar tim dapur fokus ke kuantitas dan racikan menu, sekaligus menghemat kertas roll thermal 58mm.
* **Nomor Antrian / Meja Ekstra Besar:** Header nomor meja/antrian dicetak tebal dan besar (`Double Width & Height`) agar terbaca jelas dari kejauhan di dapur.
* **Catatan Item Pesanan (*Notes*):** Permintaan khusus pelanggan (misal: *Pedas Level 3, Less Sugar, Bungkus Terpisah*) tercetak rapi di bawah item.
* **Tombol Cepat `Tiket Dapur 🍳`:** Tombol instan di layar transaksi selesai untuk mencetak atau mencetak ulang tiket koki dalam 1 klik.
* **Otomatisasi Cetak Ganda (*Smart Double Print*):** Opsi di Pengaturan Printer untuk otomatis mencetak Tiket Dapur terlebih dahulu, lalu mencetak Struk Kasir secara berurutan.
* **Tombol Tes Dapur:** Uji coba mandiri cetak tiket dapur kapan saja di pengaturan printer.

---

### 🖨️ 2. Stabilitas Printer Thermal (VSC TM-58V & Bluetooth SPP)
* **Penyembuhan Lockup Mode Grafik:** Menyuntikkan perintah `ESC @` (`0x1B, 0x40`) dan `ESC t 0` (`0x1B, 0x74, 0x00`) segera setelah logo gambar bitmap selesai dibakar, memaksa prosesor printer keluar dari mode raster dan menjamin seluruh teks struk tercetak tuntas.
* **Optimasi Buffer Logo (160 dot):** Skala logo kucing sarjana disesuaikan menjadi 160 dot, memangkas beban memori hingga 70% dan mencegah printer VSC macet di tengah jalan.
* **Pacing Thermal Bluetooth 25ms:** Ritme pengiriman data 256-byte disesuaikan ke 25ms agar jarum pemanas (*thermal print head*) memiliki waktu cukup membakar titik hitam secara stabil.
* **Persistent Socket Zero-Delay (< 10ms):** Koneksi Bluetooth RFCOMM tetap aktif di latar belakang dan melakukan *warmup* saat aplikasi dibuka, membuat proses cetak kedua dan seterusnya berjalan tanpa delay.
* **5-Line Tail Feed:** Umpan 5 baris kertas di akhir struk agar kertas keluar tuntas melewati pisau gerigi perobek tanpa terpotong teksnya.

---

### 📱 3. Integrasi WhatsApp Native & APK Update Resisten
* **WhatsApp Native Routing:** Tautan bantuan WhatsApp (`wa.me`) langsung meluncurkan aplikasi WhatsApp resmi di HP Android kasir tanpa membuka in-app browser.
* **Project Keystore Terkunci:** Sertifikat debug Android dikunci permanen sehingga update APK tidak akan pernah mengalami masalah *"Package conflicts with an existing package"*.

---

### 📦 Unduh File APK:
Unduh file **[Aristotle-POS.apk](Aristotle-POS.apk)** untuk smartphone / tablet kasir Anda.
* **Versi:** `1.1.3`
* **Version Code:** `5`
* **Target Android:** Android 7.0 (Nougat) s/d Android 14+
