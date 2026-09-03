/**
 * Kasir Mami - Module Printer Thermal (58mm / VSC TM-58V) & Cash Drawer
 * Mendukung Browser Print Dialog, Web Bluetooth ESC/POS, dan Web Serial USB Direct
 */

import { state, savePrinterConfig } from '../state.js';
import { formatRp, formatDateShort, showToast, playClick } from '../utils.js';
import { 
  syncSavePrinterConfig,
  dispatchRemotePrintJob,
  listenToRemotePrintJobs,
  updateRemotePrintJobStatus,
  waitForRemotePrintJob,
  getDeviceId
} from '../firebase.js';

// State koneksi hardware di runtime
let bluetoothDevice = null;
let bluetoothCharacteristic = null;
let serialPort = null;
let serialWriter = null;

/**
 * Konversi Gambar Base64 menjadi Byte Array ESC/POS Raster (GS v 0)
 * Menghasilkan cetakan logo monokrom tajam pada printer thermal 58mm
 */
export async function convertImageToEscPosRaster(base64Data, maxWidth = 160) {
  return new Promise((resolve) => {
    if (!base64Data) return resolve(new Uint8Array(0));
    const img = new Image();
    img.crossOrigin = 'Anonymous';
    img.onload = () => {
      let w = img.width;
      let h = img.height;
      if (w > maxWidth) {
        h = Math.round((h * maxWidth) / w);
        w = maxWidth;
      }
      w = Math.floor(w / 8) * 8; // Harus kelipatan 8
      if (w <= 0 || h <= 0) return resolve(new Uint8Array(0));

      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, w, h);
      ctx.drawImage(img, 0, 0, w, h);

      const imgData = ctx.getImageData(0, 0, w, h);
      const data = imgData.data;
      const bytesWidth = w / 8;
      const rasterBytes = [];

      // Align Center: ESC a 1
      rasterBytes.push(0x1B, 0x61, 0x01);
      // GS v 0 0 xL xH yL yH
      const xL = bytesWidth % 256;
      const xH = Math.floor(bytesWidth / 256);
      const yL = h % 256;
      const yH = Math.floor(h / 256);
      rasterBytes.push(0x1D, 0x76, 0x30, 0x00, xL, xH, yL, yH);

      for (let y = 0; y < h; y++) {
        for (let x = 0; x < bytesWidth; x++) {
          let byte = 0;
          for (let bit = 0; bit < 8; bit++) {
            const px = x * 8 + bit;
            const idx = (y * w + px) * 4;
            const r = data[idx];
            const g = data[idx + 1];
            const b = data[idx + 2];
            const a = data[idx + 3];
            const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
            // Threshold: piksel gelap = 1 (hitam)
            if (a > 50 && luminance < 170) {
              byte |= (0x80 >> bit);
            }
          }
          rasterBytes.push(byte);
        }
      }
      // Reset Align: ESC a 0
      rasterBytes.push(0x1B, 0x61, 0x00);
      rasterBytes.push(0x0A); // Linefeed setelah logo
      // Pastikan kembali ke mode text murni (ESC @ dan ESC t 0)
      rasterBytes.push(0x1B, 0x40);
      rasterBytes.push(0x1B, 0x74, 0x00);
      resolve(new Uint8Array(rasterBytes));
    };
    img.onerror = () => resolve(new Uint8Array(0));
    img.src = base64Data;
  });
}

/**
 * Buat text struk 58mm persis sesuai struktur struk thermal modern
 * Pure ASCII Sanitized: Bebas anomali karakter (Rupiah bersih, tanpa 'Rpá')
 */
export function generateReceiptPlainText(tx, customConfig = null) {
  const cfg = customConfig || state.printerConfig || {};
  const width = cfg.paperWidth === '80mm' ? 48 : 32;
  const divider = '-'.repeat(width);

  // Bersihkan karakter unicode yang bisa merusak printer thermal
  const cleanAscii = (text) => {
    return String(text || '')
      .replace(/[\u00a0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000]/g, ' ')
      .replace(/[^\x20-\x7E\n]/g, '')
      .trim();
  };

  const padCenter = (text) => {
    const str = cleanAscii(text);
    if (str.length >= width) return str.substring(0, width);
    const leftPad = Math.floor((width - str.length) / 2);
    const rightPad = width - str.length - leftPad;
    return ' '.repeat(leftPad) + str + ' '.repeat(rightPad);
  };

  const padBetween = (left, right) => {
    const lStr = cleanAscii(left);
    const rStr = cleanAscii(right);
    const space = width - lStr.length - rStr.length;
    if (space < 1) {
      return lStr.substring(0, Math.max(1, width - rStr.length - 1)) + ' ' + rStr;
    }
    return lStr + ' '.repeat(space) + rStr;
  };

  const storeName = cfg.headerStoreName || state.storeProfile?.name || 'Kedai Usaha Mami';
  const tagline = cfg.headerTagline || '';
  const address = cfg.headerAddress || state.storeProfile?.city || '';
  const phone = cfg.headerPhone || state.auth?.phone || '';
  const cashier = cfg.cashierName || state.auth?.ownerName || 'Mami';
  
  const d = tx.date ? new Date(tx.date) : new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const txDate = `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}.${pad(d.getMinutes())}.${pad(d.getSeconds())}`;
  const rawOrder = String(tx.orderName || '01').replace(/^NO ANTRIAN:?\s*/i, '');
  const method = tx.method || 'TUNAI';

  let lines = [];
  // 1. Header Toko (Center)
  lines.push(padCenter(storeName));
  if (tagline) lines.push(padCenter(tagline));
  if (address) lines.push(padCenter(address));
  if (phone) lines.push(padCenter(phone));
  lines.push(padCenter(`No. Kwitansi   #${tx.id ? tx.id.replace('TX-', '') : '001'}`));
  lines.push('');

  // 2. Waktu Pesan & Kasir
  lines.push(padBetween('Waktu Pesan', txDate));
  lines.push(padBetween('Kasir', cleanAscii(cashier)));
  lines.push(divider);

  // 3. Daftar Item (1 pcs Nama Item   Harga)
  if (Array.isArray(tx.items)) {
    tx.items.forEach(item => {
      const priceStr = formatRp(item.subtotal || (item.qty * item.price)).replace('Rp ', '');
      lines.push(padBetween(`${item.qty} pcs ${cleanAscii(item.name || 'Item')}`, priceStr));
    });
  }

  lines.push(divider);

  // 4. Ringkasan Pembayaran
  lines.push(padBetween('Subtotal', formatRp(tx.total)));
  lines.push(padBetween('TOTAL', formatRp(tx.total)));
  lines.push('');

  if (method === 'TUNAI') {
    lines.push(padBetween('Cash', formatRp(tx.cashGiven || tx.total)));
    const change = (tx.cashGiven || tx.total) - tx.total;
    if (change > 0) {
      lines.push(padBetween('Kembalian', formatRp(change)));
    }
  } else {
    lines.push(padBetween('Metode', 'QRIS (LUNAS)'));
  }

  // 5. Info Sosmed & Ucapan Terima Kasih (Center)
  if (cfg.footerSocial) {
    lines.push('');
    lines.push(padCenter(cfg.footerSocial));
  }
  lines.push('');
  lines.push(padCenter(cfg.footerNote || 'Terimakasih telah berkunjung.'));

  // 6. NO ANTRIAN (WAJIB ADA - Sesuai Permintaan & Foto)
  lines.push(divider);
  lines.push(padCenter(`NO ANTRIAN ${rawOrder.toUpperCase()}`));
  lines.push(divider);

  // Feed baris kosong di akhir agar tidak terpotong pisau printer
  const feeds = cfg.feedLines || 3;
  for (let i = 0; i < feeds; i++) {
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Konversi teks & perintah menjadi byte array ESC/POS terstruktur & rapi
 * Menggunakan perintah format native ESC/POS: Center, Bold, Double-Size Queue Number
 */
export async function buildEscPosBytes(tx, kickDrawer = false) {
  const cfg = state.printerConfig || {};
  const commands = [];

  const addBytes = (...bytes) => {
    for (let b of bytes) commands.push(b);
  };

  const addText = (text) => {
    const clean = String(text || '')
      .replace(/[\u00a0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000]/g, ' ')
      .replace(/[^\x20-\x7E\n]/g, '');
    for (let i = 0; i < clean.length; i++) {
      commands.push(clean.charCodeAt(i));
    }
  };

  const padBetween = (left, right, width = 32) => {
    const lStr = String(left || '').trim();
    const rStr = String(right || '').trim();
    const space = width - lStr.length - rStr.length;
    if (space < 1) {
      return lStr.substring(0, Math.max(1, width - rStr.length - 1)) + ' ' + rStr;
    }
    return lStr + ' '.repeat(space) + rStr;
  };

  // 1. Inisialisasi printer (ESC @) & Code Page PC437
  addBytes(0x1B, 0x40);
  addBytes(0x1B, 0x74, 0x00);

  // 2. Trigger Cash Drawer jika diminta
  if (kickDrawer) {
    const drawerBytes = buildOpenDrawerBytes();
    for (let b of drawerBytes) commands.push(b);
  }

  // 3. Sisipkan Logo Toko jika ada
  if (cfg.logoBase64 && cfg.showLogo !== false) {
    try {
      const logoRasterBytes = await convertImageToEscPosRaster(cfg.logoBase64, 160);
      for (let b of logoRasterBytes) commands.push(b);
      commands.push(0x1B, 0x40);
      commands.push(0x1B, 0x74, 0x00);
    } catch (e) {
      console.warn('Gagal render logo ESC/POS:', e);
    }
  }

  if (!tx) {
    return new Uint8Array(commands);
  }

  const storeName = cfg.headerStoreName || state.storeProfile?.name || 'Kedai Usaha Mami';
  const tagline = cfg.headerTagline || 'Cabang Utama';
  const address = cfg.headerAddress || state.storeProfile?.city || 'Samarinda, Kalimantan Timur';
  const phone = cfg.headerPhone || state.auth?.phone || '081345028895';
  const cashier = cfg.cashierName || state.auth?.ownerName || 'Mami';
  const social = cfg.footerSocial || 'Instagram: @kedai.usaha.mami';
  const note = cfg.footerNote || 'Terimakasih telah berkunjung.';

  const d = tx.date ? new Date(tx.date) : new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const txDate = `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}.${pad(d.getMinutes())}.${pad(d.getSeconds())}`;
  const rawOrder = String(tx.orderName || '01').replace(/^NO ANTRIAN:?\s*/i, '');
  const method = tx.method || 'TUNAI';
  const divider = '--------------------------------\n';

  // 4. Header Toko (Align Center)
  addBytes(0x1B, 0x61, 0x01); // Align Center
  addBytes(0x1B, 0x45, 0x01); // Bold ON
  addText(storeName + '\n');
  addBytes(0x1B, 0x45, 0x00); // Bold OFF

  if (tagline) addText(tagline + '\n');
  if (address) addText(address + '\n');
  if (phone) addText(phone + '\n');
  addText(`No. Kwitansi   #${tx.id ? tx.id.replace('TX-', '') : '001'}\n\n`);

  // 5. Waktu & Kasir (Align Left)
  addBytes(0x1B, 0x61, 0x00); // Align Left
  addText(padBetween('Waktu Pesan', txDate) + '\n');
  addText(padBetween('Kasir', cashier) + '\n');
  addText(divider);

  // 6. Daftar Item
  if (Array.isArray(tx.items)) {
    tx.items.forEach(item => {
      const priceStr = formatRp(item.subtotal || (item.qty * item.price)).replace('Rp ', '');
      addText(padBetween(`${item.qty} pcs ${item.name || 'Item'}`, priceStr) + '\n');
    });
  }

  addText(divider);

  // 7. Subtotal & TOTAL (Bold)
  addText(padBetween('Subtotal', formatRp(tx.total)) + '\n');
  addBytes(0x1B, 0x45, 0x01); // Bold ON
  addText(padBetween('TOTAL', formatRp(tx.total)) + '\n');
  addBytes(0x1B, 0x45, 0x00); // Bold OFF
  addText('\n');

  // 8. Cash / QRIS & Kembalian
  if (method === 'TUNAI') {
    addText(padBetween('Cash', formatRp(tx.cashGiven || tx.total)) + '\n');
    const change = (tx.cashGiven || tx.total) - tx.total;
    if (change > 0) {
      addText(padBetween('Kembalian', formatRp(change)) + '\n');
    }
  } else {
    addText(padBetween('Metode', 'QRIS (LUNAS)') + '\n');
  }

  // 9. Info Sosmed & Ucapan Terima Kasih (Align Center)
  addBytes(0x1B, 0x61, 0x01); // Align Center
  if (social) {
    addText('\n' + social + '\n');
  }
  addText('\n' + note + '\n');

  // 10. NO ANTRIAN BESAR (Double Width & Double Height + Bold - Persis Foto)
  addBytes(0x1B, 0x61, 0x00); // Align Left
  addText(divider);
  addBytes(0x1B, 0x61, 0x01); // Align Center
  addBytes(0x1B, 0x45, 0x01); // Bold ON
  addBytes(0x1D, 0x21, 0x11); // Double Width & Height ON
  addText(`NO ANTRIAN ${rawOrder.toUpperCase()}\n`);
  addBytes(0x1D, 0x21, 0x00); // Normal Size
  addBytes(0x1B, 0x45, 0x00); // Bold OFF
  // 11. Trigger Cash Drawer di akhir struk jika diminta
  if (kickDrawer) {
    addBytes(0x1B, 0x70, 0x00, 0x32, 0xFA);
    addBytes(0x1B, 0x70, 0x01, 0x32, 0xFA);
  }

  // Feed 5 baris agar seluruh struk keluar sempurna melewati pisau pemotong
  addBytes(0x1B, 0x64, 0x05);
  addText('\n\n');

  // Perintah Cut hanya untuk printer 80mm yang memiliki pemotong otomatis
  const paperWidth = cfg.paperWidth || '58mm';
  if (paperWidth === '80mm') {
    addBytes(0x1D, 0x56, 0x42, 0x00);
  }

  return new Uint8Array(commands);
}

/**
 * Perintah ESC/POS komprehensif untuk membuka laci kasir (Cash Drawer Kick)
 * Mengirim multi-pulse energi tinggi (Pin 2, Pin 5, 100ms, 200ms, DLE DC4, dan BEL)
 * TANPA ESC @ (Inisialisasi) agar tidak mereset buffer solenoid printer
 */
export function buildOpenDrawerBytes() {
  return new Uint8Array([
    0x1B, 0x70, 0x00, 0x32, 0xFA,       // ESC p 0 50 250 (100ms Pin 2)
    0x1B, 0x70, 0x01, 0x32, 0xFA,       // ESC p 1 50 250 (100ms Pin 5)
    0x1B, 0x70, 0x00, 0x64, 0xFA,       // ESC p 0 100 250 (200ms High Energy Pin 2)
    0x1B, 0x70, 0x01, 0x64, 0xFA,       // ESC p 1 100 250 (200ms High Energy Pin 5)
    0x10, 0x14, 0x01, 0x00, 0x08        // DLE DC4 1 0 8 (Real-time pulse)
  ]);
}

/**
 * Buat Byte Array ESC/POS Khusus Tiket Dapur / Kitchen Checkpoint
 * Format tanpa harga, nomor antrian/meja ekstra besar, dan ada kotak checklist [  ]
 */
export function buildKitchenTicketEscPosBytes(tx) {
  const commands = [];

  const addBytes = (...bytes) => {
    for (let b of bytes) commands.push(b);
  };

  const addText = (text) => {
    const clean = String(text || '')
      .replace(/[\u00a0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000]/g, ' ')
      .replace(/[^\x20-\x7E\n]/g, '');
    for (let i = 0; i < clean.length; i++) {
      commands.push(clean.charCodeAt(i));
    }
  };

  const padBetween = (left, right, width = 32) => {
    const lStr = String(left || '').trim();
    const rStr = String(right || '').trim();
    const space = width - lStr.length - rStr.length;
    if (space < 1) {
      return lStr.substring(0, Math.max(1, width - rStr.length - 1)) + ' ' + rStr;
    }
    return lStr + ' '.repeat(space) + rStr;
  };

  // 1. Inisialisasi printer (ESC @ dan PC437)
  addBytes(0x1B, 0x40);
  addBytes(0x1B, 0x74, 0x00);

  if (!tx) {
    return new Uint8Array(commands);
  }

  const d = tx.date ? new Date(tx.date) : new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const txTime = `${pad(d.getDate())}/${pad(d.getMonth() + 1)} ${pad(d.getHours())}.${pad(d.getMinutes())}.${pad(d.getSeconds())}`;
  const rawOrder = String(tx.orderName || '01').replace(/^NO ANTRIAN:?\s*/i, '');
  const divider = '--------------------------------\n';
  const doubleDivider = '================================\n';

  // 2. Header: TIKET DAPUR / BAR
  addBytes(0x1B, 0x61, 0x01); // Align Center
  addText(doubleDivider);
  addBytes(0x1B, 0x45, 0x01); // Bold ON
  addText('*** TIKET DAPUR / BAR ***\n');
  addBytes(0x1B, 0x45, 0x00); // Bold OFF
  addText(doubleDivider);

  // 3. MEJA / NO ANTRIAN (Sangat Besar: Double Width & Double Height)
  addBytes(0x1B, 0x61, 0x01); // Align Center
  addBytes(0x1B, 0x45, 0x01); // Bold ON
  addBytes(0x1D, 0x21, 0x11); // Double Width & Height ON
  addText(`${rawOrder.toUpperCase()}\n`);
  addBytes(0x1D, 0x21, 0x00); // Normal Size
  addBytes(0x1B, 0x45, 0x00); // Bold OFF
  addText(`Waktu: ${txTime}\n`);
  addText(`No. Kwitansi: #${tx.id ? tx.id.replace('TX-', '') : '001'}\n`);

  // 4. Header Kolom Checklist
  addBytes(0x1B, 0x61, 0x00); // Align Left
  addText(divider);
  addText(padBetween('STATUS / MENU', 'PORSI') + '\n');
  addText(divider);

  // 5. Daftar Item dengan Kotak Checklist [  ]
  let totalQty = 0;
  if (Array.isArray(tx.items)) {
    tx.items.forEach(item => {
      const qty = item.qty || 1;
      totalQty += qty;
      const itemName = String(item.name || 'Item').substring(0, 23);
      // Format: [  ] Nama Menu              x2
      addBytes(0x1B, 0x45, 0x01); // Bold ON
      addText(padBetween(`[  ] ${itemName}`, `x${qty}`) + '\n');
      addBytes(0x1B, 0x45, 0x00); // Bold OFF
      if (item.note) {
        addText(`     * Ket: ${item.note}\n`);
      }
    });
  }

  // 6. Ringkasan Total Porsi
  addText(divider);
  addBytes(0x1B, 0x45, 0x01); // Bold ON
  addText(padBetween(`Total: ${tx.items ? tx.items.length : 0} Item`, `${totalQty} Porsi`) + '\n');
  addBytes(0x1B, 0x45, 0x00); // Bold OFF
  addText(divider);

  // 7. Checkpoint Selesai
  addBytes(0x1B, 0x61, 0x01); // Align Center
  addText('[  ] SELESAI DIMASAK --> SERAHKAN\n');
  addText(doubleDivider);

  // 8. Feed 5 baris agar struk keluar tuntas melewati pisau gerigi
  addBytes(0x1B, 0x64, 0x05);
  addText('\n\n');

  return new Uint8Array(commands);
}

/**
 * Tampilkan modal bantuan / panduan izin Bluetooth HP
 */
export function openBluetoothTroubleshootModal(details = {}) {
  const modal = document.getElementById('bluetoothTroubleshootModal');
  if (!modal) return;

  const titleEl = document.getElementById('btTroubleTitle');
  const msgEl = document.getElementById('btTroubleMsg');
  const listEl = document.getElementById('btTroubleList');

  if (titleEl) titleEl.innerText = details.title || 'Panduan Izin Bluetooth HP';
  if (msgEl) msgEl.innerText = details.message || 'Ikuti langkah berikut agar printer terdeteksi lancar:';
  
  if (listEl) {
    const steps = details.steps || [
      'Nyalakan Bluetooth di menu pengaturan atas HP Anda.',
      'Nyalakan LOKASI / GPS di HP Anda (wajib oleh sistem Android).',
      'Buka Pengaturan HP > Aplikasi > Chrome > Izin > Izinkan "Perangkat di Sekitar".',
      'Pastikan web ini dibuka dengan HTTPS (bukan http:// biasa).'
    ];
    listEl.innerHTML = steps.map((s, idx) => `
      <li class="flex items-start gap-2.5 text-xs text-stone-700">
        <span class="w-5 h-5 rounded-full bg-blue-100 text-blue-800 font-black text-[11px] flex items-center justify-center shrink-0 mt-0.5">${idx + 1}</span>
        <span>${s}</span>
      </li>
    `).join('');
  }

  modal.classList.remove('hidden');
}

export function closeBluetoothTroubleshootModal() {
  const modal = document.getElementById('bluetoothTroubleshootModal');
  if (modal) modal.classList.add('hidden');
}

/**
 * Koneksi ke Printer Thermal via Web Bluetooth API (Dilengkapi Diagnostik Izin Otomatis)
 */
export async function connectBluetoothPrinter() {
  // 1. Cek dukungan browser
  if (!navigator.bluetooth) {
    const isSecure = window.location.protocol === 'https:' || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    if (!isSecure) {
      openBluetoothTroubleshootModal({
        title: 'Wajib Dibuka via HTTPS',
        message: 'Google Chrome di HP mematikan fitur Bluetooth jika web dibuka lewat HTTP biasa (seperti IP 192.168.x.x).',
        steps: [
          'Buka kasir menggunakan tautan resmi HTTPS (Firebase / domain Anda).',
          'Atau di laptop, gunakan koneksi USB Serial yang tidak memerlukan HTTPS.'
        ]
      });
    } else {
      showToast('Browser ini belum mendukung Web Bluetooth. Gunakan Google Chrome versi terbaru.', 'error');
    }
    return false;
  }

  // Langsung buka dialog requestDevice murni tanpa dicegat getAvailability()
  try {
    showToast('Membuka jendela printer Bluetooth...', 'info');
    
    // Panggil langsung dengan acceptAllDevices agar popup Chrome Android seketika muncul
    bluetoothDevice = await navigator.bluetooth.requestDevice({
      acceptAllDevices: true,
      optionalServices: [
        '000018f0-0000-1000-8000-00805f9b34fb',
        '0000ffe0-0000-1000-8000-00805f9b34fb',
        '0000ff00-0000-1000-8000-00805f9b34fb',
        '0000fee7-0000-1000-8000-00805f9b34fb',
        'e7810a71-73ae-499d-8c15-faa9aef0c3f2',
        '49535343-fe7d-4ae5-8fa9-9fafd205e455'
      ]
    });

    if (!bluetoothDevice) return false;

    showToast(`Menghubungkan ke ${bluetoothDevice.name || 'Printer'}...`, 'info');
    const server = await bluetoothDevice.gatt.connect();
    
    // Cari characteristic yang writable di seluruh service
    const services = await server.getPrimaryServices();
    for (const service of services) {
      try {
        const characteristics = await service.getCharacteristics();
        for (const char of characteristics) {
          if (char.properties.write || char.properties.writeWithoutResponse) {
            bluetoothCharacteristic = char;
            break;
          }
        }
      } catch (_) {}
      if (bluetoothCharacteristic) break;
    }

    if (!bluetoothCharacteristic) {
      throw new Error('Printer tidak menyediakan port tulis BLE. Di Windows Laptop, silakan gunakan tombol "Pilih Port USB" (COM10).');
    }

    updatePrinterStatusBadge('bluetooth', bluetoothDevice.name || 'Bluetooth Printer');
    showToast(`Terhubung ke printer: ${bluetoothDevice.name || 'Printer Thermal'}`, 'success');
    return true;
  } catch (err) {
    if (err.name === 'NotFoundError' || err.message?.includes('User cancelled') || err.message?.includes('cancelled')) {
      return false; // Pengguna membatalkan dialog
    }
    
    console.warn('Bluetooth Connection Warning:', err);
    
    // Jika ada error izin Android atau adapter
    if (err.message?.includes('adapter') || err.message?.includes('Location') || err.name === 'SecurityError') {
      openBluetoothTroubleshootModal({
        title: 'Izin Bluetooth / Lokasi Belum Lengkap',
        message: 'Chrome tidak diizinkan memindai printer karena aturan privasi Android.',
        steps: [
          'Pastikan GPS / Lokasi di HP dalam kondisi MENYALA.',
          'Buka Pengaturan HP > Aplikasi > Chrome > Izin > Izinkan "Perangkat di Sekitar".',
          'Pastikan printer dalam kondisi hidup (lampu indikator menyala).'
        ]
      });
    } else {
      showToast(`Bluetooth: ${err.message || 'Gagal terhubung'}`, 'warning');
    }
    return false;
  }
}

/**
 * Kirim data raw ke printer Bluetooth
 */
async function sendBluetoothData(bytes) {
  if (!bluetoothCharacteristic) {
    const ok = await connectBluetoothPrinter();
    if (!ok) {
      throw new Error('Bluetooth printer tidak terhubung.');
    }
  }

  try {
    const CHUNK_SIZE = 100;
    for (let i = 0; i < bytes.length; i += CHUNK_SIZE) {
      const chunk = bytes.slice(i, i + CHUNK_SIZE);
      await bluetoothCharacteristic.writeValue(chunk);
      await new Promise(r => setTimeout(r, 25)); // Buffer safety delay
    }
    return true;
  } catch (e) {
    console.error('Kirim Bluetooth gagal:', e);
    bluetoothCharacteristic = null;
    throw e;
  }
}

/**
 * Coba sambungkan otomatis ke port Serial yang sudah pernah diizinkan sebelumnya
 */
export async function autoReconnectSerial() {
  if (!navigator.serial) return false;
  try {
    const ports = await navigator.serial.getPorts();
    if (ports && ports.length > 0) {
      serialPort = ports[0];
      if (!serialPort.readable || !serialPort.writable) {
        await serialPort.open({ baudRate: 9600 });
      }
      serialWriter = serialPort.writable.getWriter();
      updatePrinterStatusBadge('serial', 'USB Serial Printer');
      console.log('Auto-reconnected to authorized serial/COM port');
      return true;
    }
  } catch (err) {
    console.warn('Auto reconnect serial note:', err);
  }
  return false;
}

// Inisialisasi auto-reconnect saat script dimuat
if (typeof navigator !== 'undefined' && navigator.serial) {
  setTimeout(() => { autoReconnectSerial().catch(() => {}); }, 500);
}

/**
 * Koneksi ke Printer via Web Serial (USB Port / Bluetooth Virtual COM di Windows)
 */
export async function connectSerialPrinter() {
  if (!navigator.serial) {
    showToast('Browser ini belum mendukung Web Serial. Gunakan Chrome / Edge desktop.', 'error');
    return false;
  }

  try {
    serialPort = await navigator.serial.requestPort();
    await serialPort.open({ baudRate: 9600 });
    serialWriter = serialPort.writable.getWriter();
    
    updatePrinterStatusBadge('serial', 'USB Serial Printer');
    showToast('Berhasil terhubung ke Printer Serial (COM / USB)!', 'success');
    return true;
  } catch (err) {
    if (err.name === 'NotFoundError' || err.message?.includes('No port selected')) {
      return false; // Pengguna membatalkan dialog
    }
    console.warn('Serial Connection Warning:', err);
    showToast(`Serial: ${err.message}`, 'warning');
    return false;
  }
}

/**
 * Kirim data raw ke printer Serial USB
 */
async function sendSerialData(bytes) {
  if (!serialWriter) {
    const ok = await connectSerialPrinter();
    if (!ok) {
      throw new Error('Serial USB printer tidak terhubung.');
    }
  }

  try {
    await serialWriter.write(bytes);
    return true;
  } catch (e) {
    console.error('Kirim Serial gagal:', e);
    if (serialWriter) {
      try { serialWriter.releaseLock(); } catch (_) {}
      serialWriter = null;
    }
    throw e;
  }
}

/**
 * Putuskan koneksi Serial USB
 */
export function disconnectSerialPrinter() {
  if (serialWriter) {
    try { serialWriter.releaseLock(); } catch (_) {}
    serialWriter = null;
  }
  if (serialPort) {
    try { serialPort.close(); } catch (_) {}
    serialPort = null;
  }
  resetPrinterStatusBadge();
  showToast('Koneksi port serial USB diputuskan.', 'info');
}

/**
 * Putuskan koneksi Bluetooth
 */
export function disconnectBluetoothPrinter() {
  if (bluetoothDevice && bluetoothDevice.gatt && bluetoothDevice.gatt.connected) {
    try { bluetoothDevice.gatt.disconnect(); } catch (_) {}
  }
  bluetoothDevice = null;
  bluetoothCharacteristic = null;
  resetPrinterStatusBadge();
  showToast('Koneksi Bluetooth diputuskan.', 'info');
}

/**
 * Reset badge status printer
 */
export function resetPrinterStatusBadge() {
  const badge = document.getElementById('printerConnectionBadge');
  if (badge) {
    badge.innerHTML = 'Siap Digunakan';
    badge.className = 'text-[10px] font-bold text-stone-500';
  }
}

/**
 * Cek apakah perangkat saat ini terhubung langsung ke printer fisik
 */
export function isLocalPrinterReady() {
  if (window.AndroidBridge && typeof window.AndroidBridge.isPrinterReady === 'function') {
    try {
      return !!window.AndroidBridge.isPrinterReady();
    } catch (e) {
      return false;
    }
  }
  if (bluetoothCharacteristic && bluetoothDevice && bluetoothDevice.gatt && bluetoothDevice.gatt.connected) {
    return true;
  }
  if (serialWriter && serialPort && serialPort.writable) {
    return true;
  }
  return false;
}

/**
 * Eksekusi Langsung Buka Laci Kasir secara lokal (hardware direct)
 */
export async function executeDirectLocalKickDrawer() {
  // 0. Jalur Utama APK Native
  if (window.AndroidBridge && typeof window.AndroidBridge.kickDrawer === 'function') {
    try {
      const ok = window.AndroidBridge.kickDrawer();
      if (ok) {
        showToast('Laci kasir terbuka!', 'success');
        return true;
      }
    } catch (e) {
      console.warn('Native Android kick error:', e);
    }
  }

  const modalMethod = document.getElementById('printerMethodSelect')?.value;
  const cfg = state.printerConfig || {};
  const method = (modalMethod && !document.getElementById('printerConfigModal')?.classList.contains('hidden') ? modalMethod : cfg.printMethod) || 'browser';

  // 1. Mode RawBT
  if (method === 'rawbt') {
    try {
      const bytes = buildOpenDrawerBytes();
      let binary = '';
      for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
      const b64 = window.btoa(binary);
      const intentUri = `intent:base64,${b64}#Intent;scheme=rawbt;package=ru.a402d.rawbtprinter;end;`;
      const link = document.createElement('a');
      link.href = intentUri;
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();
      setTimeout(() => { try { link.remove(); } catch (_) {} }, 500);
      showToast('Sinyal buka laci terkirim (RawBT)!', 'success');
      return true;
    } catch (e) {
      console.warn('RawBT kick error:', e);
      return false;
    }
  }

  // 2. Mode USB Serial
  if (method === 'serial') {
    try {
      const bytes = buildOpenDrawerBytes();
      await sendSerialData(bytes);
      showToast('Sinyal buka laci terkirim (USB Serial)!', 'success');
      return true;
    } catch (e) {
      console.warn('Serial kick error:', e);
      return false;
    }
  }

  // 3. Mode Web Bluetooth
  if (method === 'bluetooth') {
    if (bluetoothCharacteristic) {
      try {
        const bytes = buildOpenDrawerBytes();
        await sendBluetoothData(bytes);
        showToast('Sinyal buka laci kasir terkirim (Bluetooth)!', 'success');
        return true;
      } catch (e) {
        console.warn('Bluetooth kick error:', e);
        return false;
      }
    }
  }

  return false;
}

/**
 * Eksekusi Langsung Cetak Struk Utama secara lokal (hardware direct)
 */
export async function executeDirectLocalPrintReceipt(tx, shouldKickDrawer, forceMethod = null) {
  const modalMethod = document.getElementById('printerMethodSelect')?.value;
  const cfg = state.printerConfig || {};
  const method = forceMethod || (modalMethod && !document.getElementById('printerConfigModal')?.classList.contains('hidden') ? modalMethod : cfg.printMethod) || 'browser';

  renderPrintableReceiptArea(tx, cfg);

  // 0. Jalur Utama APK Native (Bebas Dialog, Bebas RawBT, Zero Delay)
  if (window.AndroidBridge && typeof window.AndroidBridge.printBluetooth === 'function') {
    try {
      const bytes = await buildEscPosBytes(tx, shouldKickDrawer);
      let binary = '';
      for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
      const b64 = window.btoa(binary);
      const ok = window.AndroidBridge.printBluetooth(b64);
      if (ok) {
        showToast('Struk tercetak!', 'success');
        return true;
      }
    } catch (e) {
      console.warn('Native Android Bluetooth print error:', e);
    }
  }

  if (method === 'rawbt') {
    try {
      const bytes = await buildEscPosBytes(tx, shouldKickDrawer);
      let binary = '';
      for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
      const b64 = window.btoa(binary);
      const intentUri = `intent:base64,${b64}#Intent;scheme=rawbt;package=ru.a402d.rawbtprinter;end;`;
      const link = document.createElement('a');
      link.href = intentUri;
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();
      setTimeout(() => { try { link.remove(); } catch (_) {} }, 500);
      showToast('Struk terkirim ke RawBT!', 'success');
      return true;
    } catch (e) {
      console.warn('RawBT print error:', e);
      window.print();
      return true;
    }
  } else if (method === 'bluetooth') {
    try {
      const bytes = await buildEscPosBytes(tx, shouldKickDrawer);
      await sendBluetoothData(bytes);
      showToast('Struk berhasil dicetak (Bluetooth)!', 'success');
      return true;
    } catch (e) {
      console.warn('Bluetooth print gagal:', e);
      window.print();
      return true;
    }
  } else if (method === 'serial') {
    try {
      const bytes = await buildEscPosBytes(tx, shouldKickDrawer);
      await sendSerialData(bytes);
      showToast('Struk berhasil dicetak (USB Serial)!', 'success');
      return true;
    } catch (e) {
      console.warn('Serial print gagal:', e);
      window.print();
      return true;
    }
  } else {
    window.print();
    return true;
  }
}

/**
 * Eksekusi Langsung Cetak Tiket Dapur secara lokal (hardware direct)
 */
export async function executeDirectLocalKitchenTicket(tx) {
  if (window.AndroidBridge && typeof window.AndroidBridge.printBluetooth === 'function') {
    try {
      const bytes = buildKitchenTicketEscPosBytes(tx);
      let binary = '';
      for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
      const b64 = window.btoa(binary);
      const ok = window.AndroidBridge.printBluetooth(b64);
      if (ok) {
        showToast('Tiket dapur tercetak!', 'success');
        return true;
      }
    } catch (e) {
      console.warn('Native Android Bluetooth kitchen print error:', e);
    }
  }

  const cfg = state.printerConfig || {};
  const method = cfg.printMethod || 'browser';

  if (method === 'serial') {
    try {
      const bytes = buildKitchenTicketEscPosBytes(tx);
      await sendSerialData(bytes);
      showToast('Tiket dapur terkirim (USB Serial)!', 'success');
      return true;
    } catch (e) {
      console.warn('Serial kitchen print error:', e);
    }
  }

  if (method === 'rawbt') {
    try {
      const bytes = buildKitchenTicketEscPosBytes(tx);
      let binary = '';
      for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
      const b64 = window.btoa(binary);
      const intentUri = `intent:base64,${b64}#Intent;scheme=rawbt;package=ru.a402d.rawbtprinter;end;`;
      const link = document.createElement('a');
      link.href = intentUri;
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();
      setTimeout(() => { try { link.remove(); } catch (_) {} }, 500);
      showToast('Tiket dapur terkirim ke RawBT!', 'success');
      return true;
    } catch (e) {
      console.warn('RawBT kitchen print error:', e);
    }
  }

  renderPrintableKitchenArea(tx);
  document.body.classList.add('printing-kitchen');
  showToast('Mencetak tiket dapur via browser...', 'info');
  window.print();
  setTimeout(() => {
    document.body.classList.remove('printing-kitchen');
  }, 1000);
  return true;
}

/**
 * Eksekusi Buka Laci Kasir (Cash Drawer Kick)
 * Jika perangkat terhubung printer -> Buka langsung.
 * Jika perangkat sekunder (Device 2) -> Relay via Cloud Firestore ke Device 1!
 */
export async function kickCashDrawer() {
  playClick('cash');

  // 1. Jika terhubung langsung ke printer lokal fisik (Device 1)
  if (isLocalPrinterReady()) {
    return await executeDirectLocalKickDrawer();
  }

  // 2. Jika TIDAK terhubung langsung (Device 2 / HP Pelayan), gunakan Cloud Drawer Relay!
  try {
    showToast('Mengirim sinyal buka laci ke Printer Kasir...', 'info', 3000);
    const jobId = await dispatchRemotePrintJob({ type: 'drawer' });
    await waitForRemotePrintJob(jobId, 10000);
    showToast('Laci kasir dibuka oleh Printer Kasir!', 'success', 3500);
    return true;
  } catch (err) {
    console.warn('Remote drawer kick note:', err);
    showToast('Gagal buka laci: ' + (err.message || 'Printer Kasir tidak merespons.'), 'warning', 4500);
    return false;
  }
}

/**
 * Cetak Transaksi Utama (Mendukung Multi-Device Cloud Print Relay)
 * Jika perangkat terhubung printer -> Cetak langsung (Zero Delay).
 * Jika perangkat sekunder (Device 2) -> Otomatis cetak via Kasir Utama (Device 1).
 */
export async function printReceipt(tx, forceMethod = null) {
  playClick('pop');
  const cfg = state.printerConfig || {};
  const shouldKickDrawer = cfg.autoKickDrawer && (tx.method === 'TUNAI');

  // 1. Jika perangkat ini memiliki printer lokal yang aktif (Device 1)
  if (isLocalPrinterReady()) {
    return await executeDirectLocalPrintReceipt(tx, shouldKickDrawer, forceMethod);
  }

  // 2. Jika TIDAK terhubung printer lokal (Device 2 / HP Pelayan), alihkan ke Cloud Print Relay!
  try {
    showToast('Mengirim struk ke Printer Kasir...', 'info', 3000);
    const jobId = await dispatchRemotePrintJob({
      type: 'receipt',
      tx: tx,
      forceMethod: forceMethod
    });
    showToast('Menunggu Printer Kasir mencetak...', 'info', 3000);
    await waitForRemotePrintJob(jobId, 15000);
    showToast('Struk berhasil dicetak di Printer Kasir!', 'success', 3500);
    return true;
  } catch (err) {
    console.warn('Cloud print relay note:', err);
    showToast('Gagal cetak via kasir: ' + (err.message || 'Printer Kasir tidak merespons.'), 'warning', 5000);
    return false;
  }
}

/**
 * Cetak Tiket Dapur / Kitchen Checkpoint (Mendukung Multi-Device Cloud Relay)
 */
export async function printKitchenTicket(tx) {
  playClick('pop');
  if (!tx) {
    showToast('Tidak ada data transaksi untuk dicetak.', 'warning');
    return false;
  }

  // 1. Jika perangkat ini terhubung ke printer lokal (Device 1)
  if (isLocalPrinterReady()) {
    return await executeDirectLocalKitchenTicket(tx);
  }

  // 2. Jika TIDAK terhubung printer lokal (Device 2), alihkan ke Cloud Print Relay!
  try {
    showToast('Mengirim tiket dapur ke Printer Kasir...', 'info', 3000);
    const jobId = await dispatchRemotePrintJob({
      type: 'kitchen',
      tx: tx
    });
    showToast('Menunggu Printer Kasir mencetak tiket...', 'info', 3000);
    await waitForRemotePrintJob(jobId, 15000);
    showToast('Tiket dapur berhasil dicetak di Printer Kasir!', 'success', 3500);
    return true;
  } catch (err) {
    console.warn('Cloud kitchen print relay note:', err);
    showToast('Gagal cetak tiket: ' + (err.message || 'Printer Kasir tidak merespons.'), 'warning', 5000);
    return false;
  }
}

// ================= CLOUD REMOTE PRINT LISTENER (DAEMON HOST) =================
let remotePrintUnsubscribe = null;

/**
 * Aktifkan listener di background untuk memproses tugas cetak dari perangkat lain di toko
 */
export function setupRemotePrintHostListener() {
  if (remotePrintUnsubscribe) {
    try { remotePrintUnsubscribe(); } catch (_) {}
    remotePrintUnsubscribe = null;
  }

  remotePrintUnsubscribe = listenToRemotePrintJobs(async (job) => {
    if (!job || job.status !== 'pending') return;

    // Periksa apakah perangkat ini dapat mencetak (Host Kasir)
    const canPrint = isLocalPrinterReady();
    if (!canPrint) {
      console.log('Tugas cetak diterima, namun perangkat ini sedang bukan Host Printer (isLocalPrinterReady = false).');
      return;
    }

    // Abaikan jika job dibuat oleh perangkat ini sendiri (hindari loop)
    if (job.createdBy === getDeviceId()) return;

    console.log('Menerima tugas cetak jarak jauh dari:', job.createdByName, job);

    // Kunci status menjadi processing agar tidak dieksekusi dobel
    await updateRemotePrintJobStatus(job.id, 'processing');

    try {
      if (job.type === 'receipt' && job.tx) {
        const cfg = state.printerConfig || {};
        const shouldKick = cfg.autoKickDrawer && (job.tx.method === 'TUNAI');
        await executeDirectLocalPrintReceipt(job.tx, shouldKick, job.forceMethod);
        showToast(`Mencetak struk dari [${job.createdByName || 'HP Pelayan'}]`, 'info', 3500);
      } else if (job.type === 'kitchen' && job.tx) {
        await executeDirectLocalKitchenTicket(job.tx);
        showToast(`Mencetak tiket dapur dari [${job.createdByName || 'HP Pelayan'}]`, 'info', 3500);
      } else if (job.type === 'drawer') {
        await executeDirectLocalKickDrawer();
        showToast(`Membuka laci kasir atas perintah [${job.createdByName || 'HP Pelayan'}]`, 'info', 3500);
      }

      await updateRemotePrintJobStatus(job.id, 'completed');
    } catch (err) {
      console.error('Eksekusi remote print job gagal:', err);
      await updateRemotePrintJobStatus(job.id, 'failed', { error: err.message || 'Gagal cetak' });
    }
  });
}

/**
 * Update realtime UI indikator status printer di Header & Modal
 */
export function updatePrinterUIStatus() {
  const isReady = isLocalPrinterReady();
  let printerName = '';

  if (window.AndroidBridge && typeof window.AndroidBridge.getConnectedPrinterInfo === 'function') {
    try {
      printerName = window.AndroidBridge.getConnectedPrinterInfo();
    } catch (_) {}
  }

  // Header badges
  const headerBadge = document.getElementById('headerPrinterStatusBadge');
  const headerDot = document.getElementById('headerPrinterDot');
  const headerIcon = document.getElementById('headerPrinterIcon');
  const headerText = document.getElementById('headerPrinterText');
  const mobileDot = document.getElementById('mobileHeaderPrinterDot');

  // Modal elements
  const modalBadge = document.getElementById('printerConnectionBadge');
  const roleCard = document.getElementById('multiDeviceRoleCard');
  const roleDot = document.getElementById('multiDeviceRoleDot');
  const roleTitle = document.getElementById('multiDeviceRoleTitle');
  const roleBadge = document.getElementById('multiDeviceRoleBadge');
  const roleDesc = document.getElementById('multiDeviceRoleDesc');
  const rolePrinterName = document.getElementById('multiDevicePrinterNameDisplay');
  const btnTestRelay = document.getElementById('btnTestCloudRelay');

  if (isReady) {
    // KASIR UTAMA (HOST PRINTER AKTIF)
    const displayName = printerName ? `Printer: ${printerName}` : 'Printer Terhubung (Kasir Host)';
    if (headerBadge) {
      headerBadge.className = 'hidden sm:flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-50 border border-emerald-300 text-emerald-800 text-[10px] font-black cursor-pointer shadow-2xs hover:bg-emerald-100 transition';
    }
    if (headerDot) headerDot.className = 'w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse';
    if (headerIcon) {
      headerIcon.textContent = 'print';
      headerIcon.className = 'material-symbols-rounded text-xs text-emerald-700';
    }
    if (headerText) headerText.textContent = displayName;
    if (mobileDot) mobileDot.className = 'absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-emerald-500 animate-pulse';

    if (modalBadge) {
      modalBadge.innerHTML = `<span class="text-emerald-700 font-black">● ${printerName || 'Terhubung (Kasir Host)'}</span>`;
    }

    if (roleCard) roleCard.className = 'bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex flex-col gap-2.5';
    if (roleDot) roleDot.className = 'w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse';
    if (roleTitle) roleTitle.textContent = 'KASIR UTAMA (PENCETAK TOKO)';
    if (roleBadge) {
      roleBadge.textContent = 'Host Aktif';
      roleBadge.className = 'px-2 py-0.5 rounded-full bg-emerald-200/80 text-emerald-900 font-extrabold text-[10px]';
    }
    if (roleDesc) {
      roleDesc.textContent = `Printer fisik (${printerName || 'Bluetooth'}) terhubung. Perangkat ini aktif menerima dan otomatis mencetak semua pesanan dari HP pelayan.`;
    }
    if (rolePrinterName) rolePrinterName.textContent = printerName ? `Hardware: ${printerName}` : 'Hardware: Bluetooth Thermal Standby';
    if (btnTestRelay) btnTestRelay.classList.add('hidden');

  } else {
    // HP PELAYAN (MODE CLOUD RELAY)
    if (headerBadge) {
      headerBadge.className = 'hidden sm:flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-sky-50 border border-sky-300 text-sky-800 text-[10px] font-black cursor-pointer shadow-2xs hover:bg-sky-100 transition';
    }
    if (headerDot) headerDot.className = 'w-1.5 h-1.5 rounded-full bg-sky-500';
    if (headerIcon) {
      headerIcon.textContent = 'cloud_sync';
      headerIcon.className = 'material-symbols-rounded text-xs text-sky-700';
    }
    if (headerText) headerText.textContent = 'Cloud Relay (HP Pelayan)';
    if (mobileDot) mobileDot.className = 'absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-sky-500';

    if (modalBadge) {
      modalBadge.innerHTML = `<span class="text-sky-700 font-black">☁️ Mode Cloud Relay</span>`;
    }

    if (roleCard) roleCard.className = 'bg-sky-50 border border-sky-200 rounded-2xl p-4 flex flex-col gap-2.5';
    if (roleDot) roleDot.className = 'w-2.5 h-2.5 rounded-full bg-sky-500';
    if (roleTitle) roleTitle.textContent = 'HP PELAYAN (MODE CLOUD RELAY)';
    if (roleBadge) {
      roleBadge.textContent = 'Siap Kirim ke Kasir';
      roleBadge.className = 'px-2 py-0.5 rounded-full bg-sky-200/80 text-sky-900 font-extrabold text-[10px]';
    }
    if (roleDesc) {
      roleDesc.textContent = 'Perangkat ini tidak terhubung ke printer Bluetooth. Setiap struk, tiket dapur, atau buka laci yang Anda tekan otomatis dicetak di Kasir Utama.';
    }
    if (rolePrinterName) rolePrinterName.textContent = 'Jalur: Cloud Firestore Relay (Zero Config)';
    if (btnTestRelay) btnTestRelay.classList.remove('hidden');
  }
}

/**
 * Uji Coba Pengiriman Cetak dari Device 2 ke Device 1
 */
export async function testCloudRelayPrint() {
  playClick('pop');
  const tx = {
    id: 'TES-' + Math.floor(1000 + Math.random() * 9000),
    date: new Date().toISOString(),
    items: [
      { name: 'Tes Koneksi Cloud Relay', qty: 1, price: 0, subtotal: 0 },
      { name: 'Dari: HP Pelayan', qty: 1, price: 0, subtotal: 0 },
      { name: 'Ke: Printer Kasir Utama', qty: 1, price: 0, subtotal: 0 }
    ],
    total: 0,
    paid: 0,
    change: 0,
    method: 'TUNAI',
    cashier: getDeviceName() || 'Pelayan'
  };

  try {
    showToast('Mengirim tes cetak ke Kasir Utama via Cloud...', 'info', 3000);
    const jobId = await dispatchRemotePrintJob({
      type: 'receipt',
      tx: tx
    });
    showToast('Menunggu printer kasir merespons...', 'info', 3000);
    await waitForRemotePrintJob(jobId, 12000);
    showToast('SUKSES! Printer Kasir Utama telah mencetak struk tes.', 'success', 5000);
  } catch (err) {
    showToast('Gagal tes relay: ' + (err.message || 'Kasir Utama tidak merespons.'), 'error', 5000);
  }
}

// Auto-update UI status badge periodically
if (typeof window !== 'undefined') {
  setInterval(() => {
    try { updatePrinterUIStatus(); } catch (_) {}
  }, 3500);
}

/**
 * Render elemen HTML #printArea agar pas 100% untuk kertas thermal 58mm
 */
export function renderPrintableReceiptArea(tx, cfg = null) {
  const config = cfg || state.printerConfig || {};
  const logoImgEl = document.getElementById('receiptLogoImg');
  const storeNameEl = document.getElementById('receiptStoreName');
  const taglineEl = document.getElementById('receiptTagline');
  const addressEl = document.getElementById('receiptAddress');
  const phoneEl = document.getElementById('receiptPhone');
  const txIdEl = document.getElementById('receiptTxId');
  const dateEl = document.getElementById('receiptDate');
  const orderTimeEl = document.getElementById('receiptOrderTime');
  const cashierEl = document.getElementById('receiptCashier');
  const itemListEl = document.getElementById('receiptItemList');
  const subtotalEl = document.getElementById('receiptSubtotal');
  const totalEl = document.getElementById('receiptTotal');
  const cashRow = document.getElementById('receiptCashRow');
  const changeRow = document.getElementById('receiptChangeRow');
  const socialEl = document.getElementById('receiptSocial');
  const footerNoteEl = document.getElementById('receiptFooterNote');
  const queueBoxEl = document.getElementById('receiptQueueBottomBox');
  const queueTextEl = document.getElementById('receiptQueueBottomText');

  // Logo Toko
  if (logoImgEl) {
    if (config.logoBase64 && config.showLogo !== false) {
      logoImgEl.src = config.logoBase64;
      logoImgEl.classList.remove('hidden');
    } else {
      logoImgEl.src = '';
      logoImgEl.classList.add('hidden');
    }
  }

  const activeStoreName = config.headerStoreName || state.storeProfile?.name || 'KEDAI USAHA MAMI';
  if (storeNameEl) storeNameEl.innerText = activeStoreName.toUpperCase();
  if (taglineEl) {
    taglineEl.innerText = config.headerTagline || '';
    taglineEl.style.display = config.headerTagline ? 'block' : 'none';
  }
  if (addressEl) {
    addressEl.innerText = config.headerAddress || state.storeProfile?.city || '';
    addressEl.style.display = (config.headerAddress || state.storeProfile?.city) ? 'block' : 'none';
  }
  if (phoneEl) {
    const ph = config.headerPhone || state.auth?.phone || '';
    phoneEl.innerText = ph ? `Telp/WA: ${ph}` : '';
    phoneEl.style.display = ph ? 'block' : 'none';
  }

  const d = tx.date ? new Date(tx.date) : new Date();
  const txDate = `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getFullYear()} ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
  
  if (txIdEl) txIdEl.innerText = `No. Kwitansi: #${tx.id ? tx.id.replace('TX-', '') : '001'}`;
  if (dateEl) dateEl.innerText = txDate;
  if (orderTimeEl) orderTimeEl.innerText = txDate;
  if (cashierEl) cashierEl.innerText = config.cashierName || state.auth?.ownerName || 'Mami';

  if (itemListEl && Array.isArray(tx.items)) {
    itemListEl.innerHTML = tx.items.map(item => {
      const priceStr = formatRp(item.subtotal || (item.qty * item.price)).replace('Rp ', '');
      return `
        <div class="py-1 flex justify-between items-center text-xs">
          <span class="font-bold text-stone-900">${item.qty} pcs ${item.name}</span>
          <span class="font-black text-stone-900">${priceStr}</span>
        </div>
      `;
    }).join('');
  }

  if (subtotalEl) subtotalEl.innerText = formatRp(tx.total);
  if (totalEl) totalEl.innerText = formatRp(tx.total);

  if (tx.method === 'QRIS') {
    if (cashRow) cashRow.style.display = 'none';
    if (changeRow) changeRow.style.display = 'none';
  } else {
    if (cashRow) {
      cashRow.style.display = 'flex';
      const cashValEl = document.getElementById('receiptCash');
      if (cashValEl) cashValEl.innerText = formatRp(tx.cashGiven || tx.total);
    }
    if (changeRow) {
      const changeVal = (tx.cashGiven || tx.total) - tx.total;
      if (changeVal > 0) {
        changeRow.style.display = 'flex';
        const changeValEl = document.getElementById('receiptChange');
        if (changeValEl) changeValEl.innerText = formatRp(changeVal);
      } else {
        changeRow.style.display = 'none';
      }
    }
  }

  if (socialEl) {
    socialEl.innerText = config.footerSocial || '';
    socialEl.style.display = config.footerSocial ? 'block' : 'none';
  }
  if (footerNoteEl) {
    footerNoteEl.innerText = config.footerNote || 'Terimakasih telah berkunjung.';
  }

  // Banner No Antrian Besar di Bawah
  if (queueBoxEl) {
    queueBoxEl.style.display = config.showQueueBottom !== false ? 'block' : 'none';
    if (queueTextEl) {
      queueTextEl.innerText = `NO ANTRIAN ${tx.orderName ? tx.orderName.toUpperCase() : '01'}`;
    }
  }
}

/**
 * Handle Upload Gambar Logo Toko
 */
export function handleLogoUpload(e) {
  const file = e.target.files?.[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (event) => {
    const base64 = event.target.result;
    
    // Resize & convert via canvas agar ramah memori & thermal
    const img = new Image();
    img.onload = () => {
      const maxDim = 300;
      let w = img.width;
      let h = img.height;
      if (w > maxDim || h > maxDim) {
        if (w > h) {
          h = Math.round((h * maxDim) / w);
          w = maxDim;
        } else {
          w = Math.round((w * maxDim) / h);
          h = maxDim;
        }
      }
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, w, h);
      const optimizedBase64 = canvas.toDataURL('image/png');

      // Update state
      if (!state.printerConfig) state.printerConfig = {};
      state.printerConfig.logoBase64 = optimizedBase64;
      state.printerConfig.showLogo = true;

      // Update Preview di Form Modal
      const previewImg = document.getElementById('printerLogoPreviewImg');
      const placeholder = document.getElementById('printerLogoPlaceholder');
      const removeBtn = document.getElementById('printerRemoveLogoBtn');
      if (previewImg) {
        previewImg.src = optimizedBase64;
        previewImg.classList.remove('hidden');
      }
      if (placeholder) placeholder.classList.add('hidden');
      if (removeBtn) removeBtn.classList.remove('hidden');

      updateLiveReceiptPreview();
      showToast('Logo toko berhasil diunggah!', 'success');
    };
    img.src = base64;
  };
  reader.readAsDataURL(file);
}

/**
 * Hapus Gambar Logo Toko
 */
export function removeLogoImage() {
  playClick('tap');
  if (!state.printerConfig) state.printerConfig = {};
  state.printerConfig.logoBase64 = '';
  
  const previewImg = document.getElementById('printerLogoPreviewImg');
  const placeholder = document.getElementById('printerLogoPlaceholder');
  const removeBtn = document.getElementById('printerRemoveLogoBtn');
  const logoInput = document.getElementById('printerLogoInput');

  if (previewImg) {
    previewImg.src = '';
    previewImg.classList.add('hidden');
  }
  if (placeholder) placeholder.classList.remove('hidden');
  if (removeBtn) removeBtn.classList.add('hidden');
  if (logoInput) logoInput.value = '';

  updateLiveReceiptPreview();
  showToast('Logo toko dihapus.', 'info');
}

/**
 * Ambil daftar produk riil toko untuk sampel struk
 */
function getSampleTxData() {
  const realProducts = Array.isArray(state.products) && state.products.length > 0 ? state.products : null;
  let items = [];

  if (realProducts && realProducts.length >= 2) {
    items = [
      { name: realProducts[0].name, price: realProducts[0].price, qty: 1, subtotal: realProducts[0].price },
      { name: realProducts[1].name, price: realProducts[1].price, qty: 2, subtotal: realProducts[1].price * 2 }
    ];
  } else {
    items = [
      { name: 'Nasi Uduk Komplit', price: 14000, qty: 1, subtotal: 14000 },
      { name: 'Ayam Geprek + Nasi', price: 17000, qty: 1, subtotal: 17000 },
      { name: 'Es Teh Manis', price: 5000, qty: 2, subtotal: 10000 }
    ];
  }

  const total = items.reduce((sum, it) => sum + it.subtotal, 0);

  return {
    id: 'TX-' + Math.floor(100000 + Math.random() * 900000),
    date: new Date().toISOString(),
    orderName: '01',
    method: 'TUNAI',
    items,
    total,
    cashGiven: total + 10000,
    change: 10000
  };
}

/**
 * Uji Coba Cetak Struk 58mm (Sample Test Print Menu Riil Toko)
 */
export function testPrintReceipt() {
  playClick('tap');
  const sampleTx = getSampleTxData();
  printReceipt(sampleTx);
}

/**
 * Uji Coba Cetak Tiket Dapur 58mm (Sample Test Print Kitchen Ticket)
 */
export function testPrintKitchenTicket() {
  playClick('tap');
  const sampleTx = getSampleTxData();
  printKitchenTicket(sampleTx);
}

/**
 * Buka Modal Pengaturan Printer & Struk
 */
export function openPrinterConfigModal() {
  playClick('pop');
  const cfg = state.printerConfig || {};
  
  const modal = document.getElementById('printerConfigModal');
  const paperWidthSelect = document.getElementById('printerPaperWidth');
  const printMethodSelect = document.getElementById('printerMethodSelect');
  const autoPrintCheckbox = document.getElementById('printerAutoPrint');
  const autoPrintKitchenCheckbox = document.getElementById('printerAutoPrintKitchen');
  const autoKickCheckbox = document.getElementById('printerAutoKickDrawer');
  const showLogoCheckbox = document.getElementById('printerShowLogo');
  const previewImg = document.getElementById('printerLogoPreviewImg');
  const placeholder = document.getElementById('printerLogoPlaceholder');
  const removeBtn = document.getElementById('printerRemoveLogoBtn');
  const storeNameInput = document.getElementById('printerStoreNameInput');
  const taglineInput = document.getElementById('printerTaglineInput');
  const addressInput = document.getElementById('printerAddressInput');
  const phoneInput = document.getElementById('printerPhoneInput');
  const cashierInput = document.getElementById('printerCashierInput');
  const socialInput = document.getElementById('printerSocialInput');
  const footerNoteInput = document.getElementById('printerFooterNoteInput');
  const showQueueBottomCheckbox = document.getElementById('printerShowQueueBottom');

  if (paperWidthSelect) paperWidthSelect.value = cfg.paperWidth || '58mm';
  if (printMethodSelect) printMethodSelect.value = cfg.printMethod || 'browser';
  if (autoPrintCheckbox) autoPrintCheckbox.checked = !!cfg.autoPrint;
  if (autoPrintKitchenCheckbox) autoPrintKitchenCheckbox.checked = !!cfg.autoPrintKitchen;
  if (autoKickCheckbox) autoKickCheckbox.checked = cfg.autoKickDrawer !== false;
  if (showLogoCheckbox) showLogoCheckbox.checked = cfg.showLogo !== false;

  if (cfg.logoBase64) {
    if (previewImg) { previewImg.src = cfg.logoBase64; previewImg.classList.remove('hidden'); }
    if (placeholder) placeholder.classList.add('hidden');
    if (removeBtn) removeBtn.classList.remove('hidden');
  } else {
    if (previewImg) { previewImg.src = ''; previewImg.classList.add('hidden'); }
    if (placeholder) placeholder.classList.remove('hidden');
    if (removeBtn) removeBtn.classList.add('hidden');
  }

  if (storeNameInput) storeNameInput.value = cfg.headerStoreName || state.storeProfile?.name || '';
  if (taglineInput) taglineInput.value = cfg.headerTagline || '';
  if (addressInput) addressInput.value = cfg.headerAddress || state.storeProfile?.city || '';
  if (phoneInput) phoneInput.value = cfg.headerPhone || state.auth?.phone || '';
  if (cashierInput) cashierInput.value = cfg.cashierName || 'Mami';
  if (socialInput) socialInput.value = cfg.footerSocial || '';
  if (footerNoteInput) footerNoteInput.value = cfg.footerNote || 'Terimakasih telah berkunjung.';
  if (showQueueBottomCheckbox) showQueueBottomCheckbox.checked = cfg.showQueueBottom !== false;

  updateLiveReceiptPreview();
  updatePrinterUIStatus();

  if (modal) modal.classList.remove('hidden');
}

/**
 * Tutup Modal Pengaturan Printer
 */
export function closePrinterConfigModal() {
  const modal = document.getElementById('printerConfigModal');
  if (modal) modal.classList.add('hidden');
}

/**
 * Perbarui teks pratinjau struk secara realtime di dalam modal
 */
export function updateLiveReceiptPreview() {
  const previewEl = document.getElementById('printerReceiptPreview');
  if (!previewEl) return;

  const tempCfg = {
    paperWidth: document.getElementById('printerPaperWidth')?.value || '58mm',
    logoBase64: state.printerConfig?.logoBase64 || '',
    showLogo: document.getElementById('printerShowLogo')?.checked !== false,
    headerStoreName: document.getElementById('printerStoreNameInput')?.value || '',
    headerTagline: document.getElementById('printerTaglineInput')?.value || '',
    headerAddress: document.getElementById('printerAddressInput')?.value || '',
    headerPhone: document.getElementById('printerPhoneInput')?.value || '',
    cashierName: document.getElementById('printerCashierInput')?.value || 'Mami',
    footerSocial: document.getElementById('printerSocialInput')?.value || '',
    footerNote: document.getElementById('printerFooterNoteInput')?.value || 'Terimakasih telah berkunjung.',
    footerHelp: 'Powered by Aristotle POS',
    showQueueBottom: document.getElementById('printerShowQueueBottom')?.checked !== false,
    feedLines: 2
  };

  const sampleTx = getSampleTxData();
  const receiptText = generateReceiptPlainText(sampleTx, tempCfg);
  if (previewEl.tagName === 'TEXTAREA' || previewEl.tagName === 'INPUT') {
    previewEl.value = receiptText;
  } else {
    previewEl.textContent = receiptText;
  }
}

/**
 * Simpan Formulir Pengaturan Printer
 */
export function savePrinterSettings(e) {
  if (e) e.preventDefault();
  playClick('pop');

  const paperWidth = document.getElementById('printerPaperWidth')?.value || '58mm';
  const printMethod = document.getElementById('printerMethodSelect')?.value || 'browser';
  const autoPrint = document.getElementById('printerAutoPrint')?.checked || false;
  const autoPrintKitchen = document.getElementById('printerAutoPrintKitchen')?.checked || false;
  const autoKickDrawer = document.getElementById('printerAutoKickDrawer')?.checked !== false;
  const showLogo = document.getElementById('printerShowLogo')?.checked !== false;
  const logoBase64 = state.printerConfig?.logoBase64 || '';
  const headerStoreName = document.getElementById('printerStoreNameInput')?.value.trim() || '';
  const headerTagline = document.getElementById('printerTaglineInput')?.value.trim() || '';
  const headerAddress = document.getElementById('printerAddressInput')?.value.trim() || '';
  const headerPhone = document.getElementById('printerPhoneInput')?.value.trim() || '';
  const cashierName = document.getElementById('printerCashierInput')?.value.trim() || 'Mami';
  const footerSocial = document.getElementById('printerSocialInput')?.value.trim() || '';
  const footerNote = document.getElementById('printerFooterNoteInput')?.value.trim() || 'Terimakasih telah berkunjung.';
  const showQueueBottom = document.getElementById('printerShowQueueBottom')?.checked !== false;

  const newConfig = {
    paperWidth,
    printMethod,
    autoPrint,
    autoPrintKitchen,
    autoKickDrawer,
    showLogo,
    logoBase64,
    cashierName,
    headerStoreName,
    headerTagline,
    headerAddress,
    headerPhone,
    footerSocial,
    footerNote,
    footerHelp: 'Powered by Aristotle POS',
    showQueueBottom,
    feedLines: 3
  };

  savePrinterConfig(newConfig);
  syncSavePrinterConfig(newConfig);
  closePrinterConfigModal();
  showToast('Desain & pengaturan struk berhasil disimpan!', 'success');
}

/**
 * Update Status Badge UI
 */
function updatePrinterStatusBadge(type, name) {
  const badge = document.getElementById('printerConnectionBadge');
  if (badge) {
    badge.innerHTML = `
      <span class="w-2 h-2 rounded-full bg-emerald-500"></span>
      <span>${type.toUpperCase()}: ${name}</span>
    `;
    badge.className = 'px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-300 font-extrabold text-[11px] flex items-center gap-1.5';
  }
}
