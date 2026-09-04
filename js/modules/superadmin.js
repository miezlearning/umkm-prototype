/**
 * Kasir Mami - Super Admin & Multi-UMKM Central Monitoring Module
 * Google Material Design 3 (M3) Architecture
 * Protected by Technical Passkey Gate & Session Validation
 */

import { formatRp, showToast, playClick, escapeHtml, showConfirmDialog, hashSha256 } from '../utils.js';
import { getSavedStoresList, registerStoreOnDevice, state } from '../state.js';
import { getStorageKeys, MASTER_DEV_HASH } from '../config.js';
import { 
  fetchAllStoresForSuperAdmin, 
  superAdminUpdateStorePin,
  deleteStoreFromCloud 
} from '../firebase.js';

let superAdminStores = [];
let searchQuery = '';
let isLoading = false;

const SUPERADMIN_SESSION_KEY = 'superadmin_auth_session_v1';

/**
 * Cek apakah sesi Super Admin aktif di browser saat ini
 */
export function isSuperAdminAuthenticated() {
  return sessionStorage.getItem(SUPERADMIN_SESSION_KEY) === '1';
}

/**
 * Buka modal autentikasi Super Admin (M3 Dialog)
 */
export function openSuperAdminAuthModal() {
  playClick('pop');
  const modal = document.getElementById('superAdminAuthModal');
  const input = document.getElementById('superAdminPasskeyInput');
  const eyeIcon = document.getElementById('superAdminPasskeyEyeIcon');
  if (modal) modal.classList.remove('hidden');
  if (input) {
    input.value = '';
    input.type = 'password';
    if (eyeIcon) eyeIcon.innerText = 'visibility';
    requestAnimationFrame(() => input.focus());
  }
}

/**
 * Toggle visibilitas passkey (Show / Hide Password)
 */
export function togglePasskeyVisibility() {
  playClick('tap');
  const input = document.getElementById('superAdminPasskeyInput');
  const eyeIcon = document.getElementById('superAdminPasskeyEyeIcon');
  if (!input) return;
  if (input.type === 'password') {
    input.type = 'text';
    if (eyeIcon) eyeIcon.innerText = 'visibility_off';
  } else {
    input.type = 'password';
    if (eyeIcon) eyeIcon.innerText = 'visibility';
  }
}

/**
 * Tutup modal autentikasi Super Admin dan batalkan akses
 */
export function closeSuperAdminAuthModal() {
  playClick('pop');
  const modal = document.getElementById('superAdminAuthModal');
  if (modal) modal.classList.add('hidden');

  // Jika belum terautentikasi dan saat ini berada di layar superadmin, kembalikan ke kasir
  if (!isSuperAdminAuthenticated()) {
    const viewSuperAdmin = document.getElementById('viewSuperAdmin');
    if (viewSuperAdmin && !viewSuperAdmin.classList.contains('hidden')) {
      if (window.KasirApp && window.KasirApp.switchView) {
        window.KasirApp.switchView('pos');
      }
    }
  }
}

/**
 * Verifikasi passkey Super Admin
 */
export async function handleSuperAdminAuthSubmit(e) {
  if (e) e.preventDefault();
  const input = document.getElementById('superAdminPasskeyInput');
  const enteredKey = input ? input.value.trim() : '';

  if (!enteredKey) {
    showToast('Masukkan passkey pengembang!', 'warning');
    return;
  }

  const hash = await hashSha256(enteredKey);

  // Mendukung kecocokan SHA-256 hash atau plaintext bypass developer
  if (hash === MASTER_DEV_HASH || enteredKey === 'miez_superdev_2026') {
    sessionStorage.setItem(SUPERADMIN_SESSION_KEY, '1');
    const modal = document.getElementById('superAdminAuthModal');
    if (modal) modal.classList.add('hidden');

    showToast('Akses Super Admin Terverifikasi', 'success', 2500);
    if (window.KasirApp && window.KasirApp.switchView) {
      window.KasirApp.switchView('superadmin');
    } else {
      renderSuperAdminDashboard();
    }
  } else {
    playClick('error');
    showToast('Kunci akses Super Admin salah! Silakan hubungi tim pengembang.', 'error', 3500);
    if (input) {
      input.value = '';
      input.focus();
    }
  }
}

/**
 * Keluar dari sesi Super Admin
 */
export function logoutSuperAdmin() {
  sessionStorage.removeItem(SUPERADMIN_SESSION_KEY);
  showToast('Sesi Super Admin dikunci.', 'info');
  if (window.KasirApp && window.KasirApp.switchView) {
    window.KasirApp.switchView('pos');
  }
}

/**
 * Muat data seluruh UMKM dan render dashboard monitoring
 */
export async function renderSuperAdminDashboard() {
  // Wajib lolos autentikasi Super Admin terlebih dahulu
  if (!isSuperAdminAuthenticated()) {
    openSuperAdminAuthModal();
    return;
  }

  const container = document.getElementById('superAdminStoreList');
  if (!container) return;

  isLoading = true;
  container.innerHTML = `
    <div class="col-span-full p-12 text-center flex flex-col items-center justify-center gap-3 text-stone-400">
      <div class="w-12 h-12 rounded-full bg-emerald-50 text-emerald-700 flex items-center justify-center animate-spin">
        <span class="material-symbols-rounded text-2xl">sync</span>
      </div>
      <p class="text-xs font-black text-stone-600">Mengambil data seluruh UMKM dari Cloud Firestore...</p>
      <span class="text-[11px] text-stone-400">Sinkronisasi real-time multi-tenant</span>
    </div>
  `;

  try {
    superAdminStores = await fetchAllStoresForSuperAdmin();
  } catch (err) {
    console.error('Super Admin fetch error:', err);
    superAdminStores = getSavedStoresList().map(s => ({
      id: s.id,
      name: s.name,
      ownerName: s.ownerName || 'Owner',
      phone: s.phone || '',
      pin: '1234',
      todayRevenue: 0,
      todayTxCount: 0,
      productCount: 0,
      lastActive: s.lastOpened || null
    }));
  } finally {
    isLoading = false;
  }

  updateMetricsAndList();
}

/**
 * Update metrik agregat dan render daftar kartu toko (M3 Components)
 */
export function updateMetricsAndList() {
  const container = document.getElementById('superAdminStoreList');
  const statTotalStores = document.getElementById('saStatTotalStores');
  const statTotalRevenue = document.getElementById('saStatTotalRevenue');
  const statTotalTx = document.getElementById('saStatTotalTx');

  const totalStores = superAdminStores.length;
  const totalRevenue = superAdminStores.reduce((acc, s) => acc + (s.todayRevenue || 0), 0);
  const totalTx = superAdminStores.reduce((acc, s) => acc + (s.todayTxCount || 0), 0);

  if (statTotalStores) statTotalStores.innerText = totalStores;
  if (statTotalRevenue) statTotalRevenue.innerText = formatRp(totalRevenue);
  if (statTotalTx) statTotalTx.innerText = `${totalTx} Transaksi`;

  if (!container) return;

  const filtered = superAdminStores.filter(s => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      (s.name && s.name.toLowerCase().includes(q)) ||
      (s.id && s.id.toLowerCase().includes(q)) ||
      (s.ownerName && s.ownerName.toLowerCase().includes(q)) ||
      (s.phone && s.phone.includes(q))
    );
  });

  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="col-span-full p-12 text-center rounded-[28px] bg-stone-100/70 border border-stone-200/80 flex flex-col items-center justify-center gap-2">
        <span class="material-symbols-rounded text-4xl text-stone-400">search_off</span>
        <p class="text-sm font-bold text-stone-700">Tidak ada UMKM yang cocok</p>
        <p class="text-xs text-stone-500">Coba ubah kata kunci "${escapeHtml(searchQuery)}"</p>
      </div>
    `;
    return;
  }

  container.innerHTML = filtered.map(store => {
    const isCurrent = state.isSessionActive && store.id === state.storeId;
    const waLink = store.phone ? `https://wa.me/62${store.phone.replace(/^0/, '')}` : '#';

    return `
      <div class="rounded-[24px] border ${isCurrent ? 'bg-emerald-50/60 border-emerald-300 ring-2 ring-emerald-500/20 shadow-sm' : 'bg-white border-stone-200/90 shadow-2xs hover:shadow-md'} p-5 flex flex-col justify-between gap-4 transition-all duration-200">
        
        <!-- M3 Header Section -->
        <div class="flex items-start justify-between gap-2.5">
          <div class="flex items-center gap-3 min-w-0">
            <div class="w-11 h-11 rounded-2xl ${isCurrent ? 'bg-emerald-700 text-white' : 'bg-amber-100 text-amber-900 border border-amber-200'} flex items-center justify-center font-black shrink-0 shadow-2xs">
              <span class="material-symbols-rounded text-2xl">storefront</span>
            </div>
            <div class="min-w-0">
              <div class="flex items-center gap-2">
                <h4 class="font-black text-stone-900 text-sm sm:text-base truncate tracking-tight">${escapeHtml(store.name || store.id)}</h4>
                ${isCurrent ? '<span class="px-2 py-0.5 rounded-full bg-emerald-700 text-white text-[10px] font-black shrink-0">Aktif</span>' : ''}
              </div>
              <div class="flex items-center gap-1.5 mt-0.5 flex-wrap">
                <span class="px-2 py-0.5 rounded-md bg-stone-100 border border-stone-200 text-stone-700 font-mono font-bold text-[10px]">${escapeHtml(store.id)}</span>
                <span class="text-[11px] text-stone-500 font-medium truncate">• ${escapeHtml(store.ownerName || 'Pemilik')}</span>
              </div>
            </div>
          </div>

          <!-- M3 Tonal Chip: PIN Toko -->
          <button type="button" onclick="window.KasirApp.openSuperAdminChangePin('${escapeHtml(store.id)}', '${escapeHtml(store.name || store.id)}', '${escapeHtml(store.pin || '1234')}')"
            class="px-2.5 py-1.5 rounded-full bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-950 font-bold text-xs flex items-center gap-1.5 transition active:scale-95 shrink-0"
            title="Ubah PIN Toko">
            <span class="material-symbols-rounded text-sm text-amber-700">key</span>
            <span class="font-mono font-bold">${escapeHtml(store.pin || '1234')}</span>
          </button>
        </div>

        <!-- M3 Segmented Grid Metrics -->
        <div class="grid grid-cols-3 gap-2 bg-stone-50 p-3 rounded-2xl border border-stone-200/70 text-center">
          <div class="flex flex-col">
            <span class="text-[10px] text-stone-500 font-bold uppercase tracking-wider">Omzet Hari Ini</span>
            <span class="font-black text-emerald-800 text-xs sm:text-sm mt-0.5">${formatRp(store.todayRevenue || 0)}</span>
          </div>
          <div class="flex flex-col border-x border-stone-200">
            <span class="text-[10px] text-stone-500 font-bold uppercase tracking-wider">Transaksi</span>
            <span class="font-black text-stone-800 text-xs sm:text-sm mt-0.5">${store.todayTxCount || 0} Trx</span>
          </div>
          <div class="flex flex-col">
            <span class="text-[10px] text-stone-500 font-bold uppercase tracking-wider">Katalog</span>
            <span class="font-black text-stone-800 text-xs sm:text-sm mt-0.5">${store.productCount || 0} Menu</span>
          </div>
        </div>

        <!-- M3 Action Bar (Buttons) -->
        <div class="flex items-center justify-between gap-2 pt-2 border-t border-stone-100">
          <div>
            ${store.phone ? `
              <a href="${waLink}" target="_blank"
                class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-xs font-bold transition active:scale-95">
                <span class="material-symbols-rounded text-base text-emerald-700">chat</span>
                <span class="truncate max-w-[120px]">${escapeHtml(store.phone)}</span>
              </a>
            ` : '<span class="text-[11px] text-stone-400 pl-1 font-medium">No. WA belum diatur</span>'}
          </div>

          <button type="button" onclick="window.KasirApp.impersonateStore('${escapeHtml(store.id)}')"
            class="px-4 py-2 rounded-full bg-emerald-700 hover:bg-emerald-800 active:scale-95 text-white font-extrabold text-xs flex items-center gap-1.5 shadow-xs transition">
            <span class="material-symbols-rounded text-base">login</span>
            <span>Buka Kasir</span>
          </button>
        </div>

      </div>
    `;
  }).join('');
}

/**
 * Filter pencarian toko
 */
export function handleSuperAdminSearch(e) {
  searchQuery = e?.target?.value || '';
  updateMetricsAndList();
}

/**
 * Modal Material Design 3 untuk Ganti PIN Toko
 */
export function openSuperAdminChangePin(storeId, storeName, currentPin) {
  playClick('pop');
  const modal = document.getElementById('superAdminChangePinModal');
  const targetIdInput = document.getElementById('saPinTargetStoreId');
  const storeNameEl = document.getElementById('saPinModalStoreName');
  const storeIdEl = document.getElementById('saPinModalStoreId');
  const pinInput = document.getElementById('saNewPinInput');

  if (targetIdInput) targetIdInput.value = storeId;
  if (storeNameEl) storeNameEl.innerText = storeName || storeId;
  if (storeIdEl) storeIdEl.innerText = storeId;
  if (pinInput) {
    pinInput.value = currentPin || '1234';
    requestAnimationFrame(() => pinInput.focus());
  }

  if (modal) modal.classList.remove('hidden');
}

export function closeSuperAdminChangePinModal() {
  playClick('pop');
  const modal = document.getElementById('superAdminChangePinModal');
  if (modal) modal.classList.add('hidden');
}

export async function handleSuperAdminChangePinSubmit(e) {
  if (e) e.preventDefault();
  const targetIdInput = document.getElementById('saPinTargetStoreId');
  const pinInput = document.getElementById('saNewPinInput');
  const storeId = targetIdInput ? targetIdInput.value : '';
  const newPin = pinInput ? pinInput.value.trim() : '';

  if (!storeId || !newPin) {
    showToast('Masukkan PIN baru yang valid', 'warning');
    return;
  }

  const ok = await superAdminUpdateStorePin(storeId, newPin);
  if (ok) {
    closeSuperAdminChangePinModal();
    showToast(`PIN toko [${storeId}] berhasil diubah menjadi: ${newPin}`, 'success');
    renderSuperAdminDashboard();
  } else {
    showToast('Gagal mengubah PIN toko di Firestore', 'error');
  }
}
