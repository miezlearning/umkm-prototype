/**
 * Kasir Mami - Utility Functions
 */

/**
 * Format angka ke mata uang Rupiah
 * @param {number} num
 * @returns {string} Contoh: "Rp 15.000"
 */
export const formatRp = (num) => {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(num || 0);
};

/**
 * Bunyikan audio beep taktil saat aksi kasir
 * @param {number} freq Frekuensi audio (Hz)
 * @param {number} duration Durasi dalam detik
 */
export function playBeep(freq = 600, duration = 0.08) {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.1, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + duration);
  } catch (e) {
    // Ignore audio error if not permitted
  }
}

/**
 * Format tanggal format pendek Indonesia (e.g. "27 Agu, 11:30")
 * @param {string|Date} dateVal
 * @returns {string}
 */
export function formatDateShort(dateVal) {
  return new Date(dateVal).toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit'
  });
}

/**
 * Format tanggal panjang Indonesia (e.g. "27 Agustus 2026")
 * @param {string|Date} dateVal
 * @returns {string}
 */
export function formatDateFull(dateVal) {
  return new Date(dateVal).toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });
}

/**
 * Escape karakter berbahaya untuk keamanan rendering string
 * @param {string} str
 * @returns {string}
 */
export function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
