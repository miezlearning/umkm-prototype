/**
 * Kasir Mami - Dynamic QRIS Generator & EMVCo Payload Parser
 * Standard Bank Indonesia (QRIS) & EMVCo Specification
 */

// Default QRIS Statis Merchant (Kedai Usaha Mami - Mandiri Livin')
export const FALLBACK_QRIS_PAYLOAD = '00020101021126690021ID.CO.BANKMANDIRI.WWW01189360000801942889650211719428896580303UMI51440014ID.CO.QRIS.WWW0215ID10254505223350303UMI5204581253033605802ID5916KEDAI USAHA MAMI6015Samarinda (Kota61057511962070703A016304EA56';

/**
 * Hitung Checksum CRC16 CCITT (0xFFFF / 0x1021) standar EMVCo QRIS
 * @param {string} str - QRIS string payload tanpa 4 karakter CRC terakhir
 * @returns {string} - 4 karakter heksadesimal CRC16 (uppercase)
 */
export function calculateCRC16(str) {
  let crc = 0xFFFF;
  for (let c = 0; c < str.length; c++) {
    crc ^= str.charCodeAt(c) << 8;
    for (let i = 0; i < 8; i++) {
      if ((crc & 0x8000) !== 0) {
        crc = ((crc << 1) ^ 0x1021) & 0xFFFF;
      } else {
        crc = (crc << 1) & 0xFFFF;
      }
    }
  }
  let hex = (crc & 0xFFFF).toString(16).toUpperCase();
  while (hex.length < 4) hex = '0' + hex;
  return hex;
}

/**
 * Parse string QRIS menjadi array objek TLV (Tag-Length-Value) standar EMVCo
 * @param {string} qrisStr - Raw string QRIS
 * @returns {Array<{tag: string, length: number, value: string}>}
 */
export function parseEMVCoTLV(qrisStr) {
  if (!qrisStr || typeof qrisStr !== 'string') return [];
  let payload = qrisStr.trim();
  
  // Buang tag 6304 di akhir jika ada agar parsing TLV bersih
  const crcIndex = payload.lastIndexOf('6304');
  if (crcIndex !== -1 && crcIndex === payload.length - 8) {
    payload = payload.substring(0, crcIndex);
  }

  const tags = [];
  let i = 0;
  while (i < payload.length) {
    if (i + 4 > payload.length) break;
    const tag = payload.substring(i, i + 2);
    const lenStr = payload.substring(i + 2, i + 4);
    const length = parseInt(lenStr, 10);
    if (isNaN(length) || length < 0 || i + 4 + length > payload.length) {
      break;
    }
    const value = payload.substring(i + 4, i + 4 + length);
    tags.push({ tag, length, value });
    i += 4 + length;
  }
  return tags;
}

/**
 * Ekstrak informasi metadata merchant dari payload QRIS
 * @param {string} payload - String QRIS
 * @returns {{merchantName: string, city: string, postalCode: string, nmid: string, acquirer: string}}
 */
export function parseQRISMetadata(payload) {
  const tags = parseEMVCoTLV(payload);
  const tagMap = {};
  tags.forEach(t => { tagMap[t.tag] = t.value; });

  const merchantName = tagMap['59'] || 'Kedai Usaha Mami';
  const city = tagMap['60'] || '';
  const postalCode = tagMap['61'] || '';

  // Ekstrak NMID dari Sub-tag 02 pada Tag 51 (Standar QRIS Nasional)
  let nmid = '';
  let criteria = '';
  if (tagMap['51']) {
    const subTags51 = parseEMVCoTLV(tagMap['51']);
    const subMap51 = {};
    subTags51.forEach(st => { subMap51[st.tag] = st.value; });
    if (subMap51['02']) {
      nmid = subMap51['02'];
    }
    if (subMap51['03']) {
      criteria = subMap51['03'];
    }
  }

  // Fallback deteksi Tag 26 jika Tag 51 tidak ada
  if (!nmid && tagMap['26']) {
    const subTags26 = parseEMVCoTLV(tagMap['26']);
    const subMap26 = {};
    subTags26.forEach(st => { subMap26[st.tag] = st.value; });
    if (subMap26['02']) nmid = subMap26['02'];
  }

  // Deteksi Penyelenggara / Acquirer
  let acquirer = 'QRIS GPN';
  if (tagMap['26'] && tagMap['26'].includes('BANKMANDIRI')) acquirer = "Livin' by Mandiri";
  else if (tagMap['26'] && tagMap['26'].includes('BCA')) acquirer = 'BCA';
  else if (tagMap['26'] && tagMap['26'].includes('GOPAY')) acquirer = 'GoPay';
  else if (tagMap['26'] && tagMap['26'].includes('DANA')) acquirer = 'DANA';
  else if (tagMap['26'] && tagMap['26'].includes('SHOPEE')) acquirer = 'ShopeePay';

  return {
    merchantName,
    city,
    postalCode,
    nmid: nmid || 'ID1025450522335',
    criteria,
    acquirer
  };
}

/**
 * Konversi String QRIS Statis menjadi QRIS Dinamis dengan nominal spesifik (Standar EMVCo TLV)
 * @param {string} rawQris - String QRIS Statis dasar
 * @param {number} amount - Nominal transaksi (Rupiah)
 * @returns {string} - String QRIS Dinamis yang 100% valid dan siap di-scan
 */
export function generateDynamicQRIS(rawQris, amount) {
  if (!rawQris || typeof rawQris !== 'string' || !rawQris.startsWith('000201')) {
    rawQris = FALLBACK_QRIS_PAYLOAD;
  }

  const tags = parseEMVCoTLV(rawQris);
  if (tags.length === 0) {
    return rawQris;
  }

  const amountVal = Math.round(amount || 0).toString();
  const newTags = [];
  let insertedAmount = false;

  tags.forEach(item => {
    if (item.tag === '01') {
      // 01 = Point of Initiation Method. 12 = Dynamic (Nominal Pas)
      newTags.push({ tag: '01', value: '12' });
    } else if (item.tag === '54') {
      // Jika sudah ada tag 54, ganti dengan nominal baru
      if (amountVal && amountVal !== '0') {
        newTags.push({ tag: '54', value: amountVal });
        insertedAmount = true;
      }
    } else {
      // Sisipkan Tag 54 sebelum Tag 58 (Country Code) / Tag 59 (Merchant Name) sesuai spesifikasi EMVCo
      if (['58', '59', '60'].includes(item.tag) && !insertedAmount && amountVal && amountVal !== '0') {
        newTags.push({ tag: '54', value: amountVal });
        insertedAmount = true;
      }
      newTags.push({ tag: item.tag, value: item.value });
    }
  });

  // Jika belum tersisip karena tidak ada tag 58/59, tambahkan di akhir sebelum CRC
  if (!insertedAmount && amountVal && amountVal !== '0') {
    newTags.push({ tag: '54', value: amountVal });
  }

  // Serialisasi kembali ke string EMVCo TLV
  let buffer = '';
  newTags.forEach(item => {
    const lenStr = item.value.length < 10 ? '0' + item.value.length : item.value.length.toString();
    buffer += `${item.tag}${lenStr}${item.value}`;
  });

  // Tambahkan Tag 63 (CRC16) dan hitung checksum
  buffer += '6304';
  const checksum = calculateCRC16(buffer);
  return buffer + checksum;
}

/**
 * Render QR Code ke elemen DOM container
 * @param {HTMLElement} containerEl - Elemen wrapper target
 * @param {string} text - Teks/payload QRIS
 * @param {number} size - Ukuran piksel
 */
export function renderQRToContainer(containerEl, text, size = 240) {
  if (!containerEl || !text) return;
  containerEl.innerHTML = '';

  if (window.QRCode) {
    try {
      new window.QRCode(containerEl, {
        text: text,
        width: size,
        height: size,
        colorDark: '#1C1917',
        colorLight: '#FFFFFF',
        correctLevel: window.QRCode.CorrectLevel ? window.QRCode.CorrectLevel.M : 0
      });
    } catch (e) {
      console.error('Error rendering QR code with QRCodeJS:', e);
      fallbackRenderQR(containerEl, text, size);
    }
  } else {
    fallbackRenderQR(containerEl, text, size);
  }
}

function fallbackRenderQR(containerEl, text, size) {
  const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(text)}`;
  containerEl.innerHTML = `
    <img src="${qrApiUrl}" alt="QRIS Code" class="w-[${size}px] h-[${size}px] object-contain rounded-xl" />
  `;
}

/**
 * Ekstrak / Baca kode QRIS dari file gambar menggunakan jsQR dengan multi-pass scanning
 * @param {File} file - File gambar banner QRIS
 * @returns {Promise<string>} - String payload QRIS yang terbaca
 */
export function decodeQRFromImage(file) {
  return new Promise((resolve, reject) => {
    if (!file) {
      return reject(new Error('File gambar tidak ditemukan'));
    }

    const reader = new FileReader();
    reader.onload = function(e) {
      const img = new Image();
      img.onload = function() {
        try {
          if (!window.jsQR) {
            return reject(new Error('Library scanner jsQR belum siap.'));
          }

          // 1. Scan dengan canvas resolusi teroptimasi (Max 1200px)
          const maxDim = 1200;
          let width = img.width;
          let height = img.height;
          if (width > maxDim || height > maxDim) {
            if (width > height) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            } else {
              width = Math.round((width * maxDim) / height);
              height = maxDim;
            }
          }

          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          canvas.width = width;
          canvas.height = height;
          ctx.drawImage(img, 0, 0, width, height);

          let imageData = ctx.getImageData(0, 0, width, height);
          
          // Pass 1: Direct Full Scan
          let code = window.jsQR(imageData.data, width, height, { inversionAttempts: 'dontInvert' });
          if (code && code.data && code.data.startsWith('000201')) {
            return resolve(code.data);
          }

          // Pass 2: Inverted Full Scan
          code = window.jsQR(imageData.data, width, height, { inversionAttempts: 'onlyInvert' });
          if (code && code.data && code.data.startsWith('000201')) {
            return resolve(code.data);
          }

          // Pass 3: Center Crop (Area 60% tengah gambar tempat QR biasanya berada)
          const cropW = Math.round(width * 0.7);
          const cropH = Math.round(height * 0.7);
          const startX = Math.round((width - cropW) / 2);
          const startY = Math.round((height - cropH) / 2);
          const cropData = ctx.getImageData(startX, startY, cropW, cropH);

          code = window.jsQR(cropData.data, cropW, cropH, { inversionAttempts: 'attemptBoth' });
          if (code && code.data && code.data.startsWith('000201')) {
            return resolve(code.data);
          }

          // Pass 4: Any detected QR code
          if (code && code.data) {
            return resolve(code.data);
          }

          reject(new Error('Tidak dapat menemukan QR Code QRIS pada gambar tersebut. Pastikan foto QRIS tegak, terang, dan tidak terpotong.'));
        } catch (err) {
          reject(err);
        }
      };
      img.onerror = () => reject(new Error('Gagal memuat file gambar.'));
      img.src = e.target.result;
    };
    reader.onerror = () => reject(new Error('Gagal membaca file gambar.'));
    reader.readAsDataURL(file);
  });
}

