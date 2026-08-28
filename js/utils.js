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

let audioCtx = null;

function getAudioContext() {
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) return null;
  if (!audioCtx) audioCtx = new AudioCtx();
  if (audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

/**
 * Bunyikan audio beep taktil saat aksi kasir (Instant 0ms Audio)
 * @param {number} freq Frekuensi audio (Hz)
 * @param {number} duration Durasi dalam detik
 */
export function playBeep(freq = 600, duration = 0.08) {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.12, ctx.currentTime);
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
 * Suara sentuhan taktil instan untuk berbagai aksi UI kasir
 * @param {'tap'|'keypad'|'cash'|'switch'|'pop'|'del'} type 
 */
export function playClick(type = 'tap') {
  const sounds = {
    tap: [650, 0.045],       // Sentuh produk / tambah item
    keypad: [750, 0.035],    // Ketik angka di keypad
    cash: [820, 0.07],       // Pilih pecahan uang
    switch: [520, 0.05],     // Ganti tab antrian / kategori / menu
    pop: [600, 0.06],        // Buka modal / aksi cepat
    del: [400, 0.06]         // Hapus / kurangi item
  };
  const [freq, duration] = sounds[type] || sounds.tap;
  playBeep(freq, duration);
}

/**
 * Nada sukses transaksi kasir (Pleasant Double Register Chime)
 */
export function playSuccessChime() {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const t = ctx.currentTime;

    // Nada 1: E5 (659 Hz)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.frequency.value = 659.25;
    gain1.gain.setValueAtTime(0.14, t);
    gain1.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(t);
    osc1.stop(t + 0.15);

    // Nada 2: B5 (987 Hz)
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.frequency.value = 987.77;
    gain2.gain.setValueAtTime(0.16, t + 0.1);
    gain2.gain.exponentialRampToValueAtTime(0.001, t + 0.38);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(t + 0.1);
    osc2.stop(t + 0.38);
  } catch (e) {}
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
 * @param {object|null} action Opsi tombol aksi { label: string, onClick: function }
 */
export function showToast(message, type = 'success', duration = 3000, action = null) {
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

  toast.className = `toast-item px-4 py-3 rounded-2xl shadow-2xl border backdrop-blur-md flex items-center justify-between gap-3 w-full select-none ${config.bg}`;
  toast.innerHTML = `
    <div class="flex items-center gap-2.5 min-w-0 flex-1">
      <span class="material-symbols-rounded text-2xl shrink-0 ${config.iconColor}">${config.icon}</span>
      <span class="text-xs sm:text-sm font-extrabold leading-snug break-words">${escapeHtml(message)}</span>
    </div>
    <div class="flex items-center gap-2 shrink-0">
      ${action ? `
        <button type="button" class="toast-action-btn px-2.5 py-1 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-stone-950 font-black text-xs transition active:scale-95 shadow">
          ${escapeHtml(action.label || 'URUNGKAN')}
        </button>
      ` : ''}
      <button type="button" class="toast-close-btn opacity-40 hover:opacity-100 transition p-0.5">
        <span class="material-symbols-rounded text-base">close</span>
      </button>
    </div>
  `;

  playBeep(config.sound, 0.06);

  let isDismissed = false;
  const dismiss = () => {
    if (isDismissed) return;
    isDismissed = true;
    toast.classList.add('toast-out');
    setTimeout(() => toast.remove(), 220);
  };

  const closeBtn = toast.querySelector('.toast-close-btn');
  if (closeBtn) {
    closeBtn.onclick = (e) => {
      e.stopPropagation();
      dismiss();
    };
  }

  if (action && action.onClick) {
    const actionBtn = toast.querySelector('.toast-action-btn');
    if (actionBtn) {
      actionBtn.onclick = (e) => {
        e.stopPropagation();
        dismiss();
        action.onClick();
      };
    }
  }

  container.appendChild(toast);

  if (duration > 0) {
    setTimeout(dismiss, duration);
  }
}

/**
 * Custom Material Design 3 Confirmation Dialog (Pengganti confirm() browser)
 * @param {object} options
 * @returns {Promise<boolean>}
 */
export function showConfirmDialog({ 
  title = 'Konfirmasi Tindakan', 
  message = 'Apakah Anda yakin ingin melanjutkan?', 
  confirmText = 'Ya, Lanjutkan', 
  confirmType = 'danger',
  icon = 'warning'
} = {}) {
  return new Promise((resolve) => {
    let modal = document.getElementById('customConfirmModal');
    if (!modal) {
      // Fallback if modal container not in DOM
      resolve(true);
      return;
    }

    const titleEl = document.getElementById('customConfirmTitle');
    const msgEl = document.getElementById('customConfirmMessage');
    const iconEl = document.getElementById('customConfirmIcon');
    const okBtn = document.getElementById('customConfirmOkBtn');
    const cancelBtn = document.getElementById('customConfirmCancelBtn');

    if (titleEl) titleEl.innerText = title;
    if (msgEl) msgEl.innerText = message;
    if (iconEl) iconEl.innerText = icon;
    
    if (okBtn) {
      okBtn.innerText = confirmText;
      okBtn.className = confirmType === 'danger'
        ? 'px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-black text-xs sm:text-sm touch-target-large shadow transition active:scale-95'
        : 'px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-stone-950 font-black text-xs sm:text-sm touch-target-large shadow transition active:scale-95';
    }

    const cleanup = (result) => {
      modal.classList.add('hidden');
      if (okBtn) okBtn.onclick = null;
      if (cancelBtn) cancelBtn.onclick = null;
      resolve(result);
    };

    if (okBtn) okBtn.onclick = () => cleanup(true);
    if (cancelBtn) cancelBtn.onclick = () => cleanup(false);

    // Instant zero-delay display
    modal.classList.remove('hidden');
    playBeep(450, 0.06);
  });
}

if (typeof window !== 'undefined') {
  window.showToast = showToast;
  window.showConfirmDialog = showConfirmDialog;
  window.playBeep = playBeep;
  window.playClick = playClick;
  window.playSuccessChime = playSuccessChime;
}
