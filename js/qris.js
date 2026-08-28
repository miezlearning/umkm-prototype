/**
 * Kasir Mami - Dynamic QRIS Generator & EMVCo Payload Parser
 * Standard Bank Indonesia (QRIS) & EMVCo Specification
 */

export const FALLBACK_QRIS_PAYLOAD = '00020101021126590014ID.GO.GPN.WWW01189360091400000000000215000000000000000051440014ID.CO.QRIS.WWW02150000000000000005204581253033605802ID5923KEDAI MAMI BERKAH UMKM6007JAKARTA61051234062070703A01630489AB';

/**
 * Hitung Checksum CRC16 CCITT (0xFFFF / 0x1021) standar EMVCo QRIS
 * @param {string} str - QRIS string payload
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
 * Konversi String QRIS Statis menjadi QRIS Dinamis dengan nominal spesifik
 * @param {string} rawQris - String QRIS Statis dasar
 * @param {number} amount - Nominal transaksi (Rupiah)
 * @returns {string} - String QRIS Dinamis siap di-generate ke QR Code
 */
export function generateDynamicQRIS(rawQris, amount) {
  if (!rawQris || typeof rawQris !== 'string') {
    rawQris = FALLBACK_QRIS_PAYLOAD;
  }

  let qris = rawQris.trim();

  // 1. Buang tag 6304 (CRC) di bagian akhir jika ada
  if (qris.includes('6304')) {
    qris = qris.substring(0, qris.lastIndexOf('6304'));
  }

  // 2. Ubah indikator static (010211) menjadi dynamic (010212)
  qris = qris.replace('010211', '010212');

  // 3. Format Tag 54 (Transaction Amount)
  const amountStr = Math.round(amount).toString();
  const amountLen = amountStr.length < 10 ? '0' + amountStr.length : amountStr.length.toString();
  const tag54 = `54${amountLen}${amountStr}`;

  // 4. Hapus tag 54 lama jika ada di dalam string
  qris = qris.replace(/54\d{2}\d+/, '');

  // 5. Sisipkan tag 54 sebelum tag 58 (Country code 5802ID) sesuai spesifikasi EMVCo
  if (qris.includes('5802ID')) {
    const parts = qris.split('5802ID');
    qris = parts[0] + tag54 + '5802ID' + parts.slice(1).join('5802ID');
  } else if (qris.includes('5303360')) {
    // Jika tidak ada 5802ID, letakkan setelah mata uang Rupiah (5303360)
    qris = qris.replace('5303360', '5303360' + tag54);
  } else {
    qris += tag54;
  }

  // 6. Tambahkan tag 6304 dan hitung CRC16 baru
  qris += '6304';
  const crc = calculateCRC16(qris);
  return qris + crc;
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
    new window.QRCode(containerEl, {
      text: text,
      width: size,
      height: size,
      colorDark: '#1C1917',
      colorLight: '#FFFFFF',
      correctLevel: window.QRCode.CorrectLevel ? window.QRCode.CorrectLevel.M : 0
    });
  } else {
    console.warn('Library QRCode (qrcodejs) belum termuat.');
    containerEl.innerHTML = `
      <div class="text-center p-2 text-xs text-amber-800 font-bold bg-amber-50 rounded-xl border border-amber-300">
        QRIS: ${text.slice(0, 24)}...
      </div>
    `;
  }
}

/**
 * Ekstrak / Baca kode QRIS dari file gambar menggunakan jsQR
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
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          canvas.width = img.width;
          canvas.height = img.height;
          ctx.drawImage(img, 0, 0, img.width, img.height);

          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          
          if (window.jsQR) {
            const code = window.jsQR(imageData.data, imageData.width, imageData.height, {
              inversionAttempts: 'dontInvert'
            });

            if (code && code.data) {
              resolve(code.data);
            } else {
              const codeInverted = window.jsQR(imageData.data, imageData.width, imageData.height, {
                inversionAttempts: 'onlyInvert'
              });
              if (codeInverted && codeInverted.data) {
                resolve(codeInverted.data);
              } else {
                reject(new Error('Tidak dapat menemukan QR Code yang valid pada gambar tersebut. Pastikan foto QRIS tegak, terang, dan tidak blur.'));
              }
            }
          } else {
            reject(new Error('Library scanner jsQR belum siap.'));
          }
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
