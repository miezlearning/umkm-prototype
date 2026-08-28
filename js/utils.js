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

/**
 * Tampilkan Custom Toast Notification modern ala Material 3
 * @param {string} message Pesan teks
 * @param {'success'|'error'|'info'|'warning'} type Jenis toast
 * @param {number} duration Durasi tampil (ms)
 */
export function showToast(message, type = 'success', duration = 3000) {
  let container = document.getElementById('toastContainer');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toastContainer';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');

  const config = {
    success: {
      bg: 'bg-stone-900 text-white border-emerald-500/50',
      icon: 'check_circle',
      iconColor: 'text-emerald-400',
      sound: 800
    },
    error: {
      bg: 'bg-red-950 text-white border-red-500/50',
      icon: 'error',
      iconColor: 'text-red-400',
      sound: 300
    },
    warning: {
      bg: 'bg-amber-950 text-white border-amber-500/50',
      icon: 'warning',
      iconColor: 'text-amber-400',
      sound: 500
    },
    info: {
      bg: 'bg-stone-900 text-white border-stone-700',
      icon: 'info',
      iconColor: 'text-emerald-300',
      sound: 600
    }
  }[type] || {
    bg: 'bg-stone-900 text-white border-stone-700',
    icon: 'info',
    iconColor: 'text-emerald-400',
    sound: 600
  };

  toast.className = `toast-item px-4 py-3 rounded-2xl shadow-2xl border backdrop-blur-md flex items-center justify-between gap-3 w-full cursor-pointer select-none ${config.bg}`;
  toast.innerHTML = `
    <div class="flex items-center gap-2.5 min-w-0">
      <span class="material-symbols-rounded text-2xl shrink-0 ${config.iconColor}">${config.icon}</span>
      <span class="text-xs sm:text-sm font-extrabold leading-snug break-words">${escapeHtml(message)}</span>
    </div>
    <span class="material-symbols-rounded text-base opacity-40 hover:opacity-100 shrink-0">close</span>
  `;

  playBeep(config.sound, 0.06);

  const dismiss = () => {
    toast.classList.add('toast-out');
    setTimeout(() => toast.remove(), 220);
  };

  toast.onclick = dismiss;

  container.appendChild(toast);

  if (duration > 0) {
    setTimeout(dismiss, duration);
  }
}

if (typeof window !== 'undefined') {
  window.showToast = showToast;
}
