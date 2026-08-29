/**
 * Kasir Mami - Super Admin & Multi-UMKM Central Monitoring Module
 */

import { formatRupiah, showToast, playClick, escapeHtml, showConfirmDialog } from '../utils.js';
import { getSavedStoresList, registerStoreOnDevice, state } from '../state.js';
import { getStorageKeys } from '../config.js';
import { 
  fetchAllStoresForSuperAdmin, 
  superAdminUpdateStorePin 
} from '../firebase.js';

let superAdminStores = [];
let searchQuery = '';
let isLoading = false;

/**
 * Muat data seluruh UMKM dan render dashboard monitoring
 */
export async function renderSuperAdminDashboard() {
  const container = document.getElementById('superAdminStoreList');
  const summaryEl = document.getElementById('superAdminSummary');
  if (!container) return;

  isLoading = true;
  container.innerHTML = `
    <div class="p-8 text-center flex flex-col items-center justify-center gap-2 text-stone-400">
      <span class="material-symbols-rounded text-3xl animate-spin text-emerald-600">sync</span>
      <p class="text-xs font-bold">Mengambil data seluruh UMKM dari Cloud Firestore...</p>
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
 * Update metrik agregat dan render daftar kartu toko
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
  if (statTotalRevenue) statTotalRevenue.innerText = formatRupiah(totalRevenue);
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
      <div class="p-8 text-center text-stone-400 font-bold text-xs">
        Tidak ada UMKM yang cocok dengan pencarian "${escapeHtml(searchQuery)}".
      </div>
    `;
    return;
  }

  container.innerHTML = filtered.map(store => {
    const isCurrent = state.isSessionActive && store.id === state.storeId;
    const waLink = store.phone ? `https://wa.me/62${store.phone.replace(/^0/, '')}` : '#';

    return `
      <div class="p-4 sm:p-5 rounded-2xl border ${isCurrent ? 'bg-emerald-50/70 border-emerald-300 ring-2 ring-emerald-500/20' : 'bg-white border-stone-200'} flex flex-col gap-3.5 hover:shadow-md transition">
        <div class="flex items-start justify-between gap-2">
          <div class="flex items-center gap-3 min-w-0">
            <div class="w-10 h-10 rounded-2xl ${isCurrent ? 'bg-emerald-700 text-white' : 'bg-stone-100 text-stone-700'} flex items-center justify-center font-black shrink-0">
              <span class="material-symbols-rounded text-xl">storefront</span>
            </div>
            <div class="min-w-0">
              <div class="flex items-center gap-2">
                <h4 class="font-black text-stone-900 text-sm sm:text-base truncate">${escapeHtml(store.name || store.id)}</h4>
                ${isCurrent ? '<span class="px-2 py-0.5 rounded-md bg-emerald-700 text-white text-[10px] font-black">Toko Aktif</span>' : ''}
              </div>
              <p class="text-[11px] text-stone-500 font-medium truncate">
                ID: <span class="font-mono text-stone-700 font-bold">${escapeHtml(store.id)}</span> • Owner: <span class="font-bold text-stone-800">${escapeHtml(store.ownerName || '-')}</span>
              </p>
            </div>
          </div>

          <div class="flex items-center gap-1.5 shrink-0">
            <button onclick="window.KasirApp.openSuperAdminChangePin('${escapeHtml(store.id)}', '${escapeHtml(store.name || store.id)}', '${escapeHtml(store.pin || '1234')}')"
              class="px-2.5 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 font-bold text-xs flex items-center gap-1 transition"
              title="Ganti PIN Toko">
              <span class="material-symbols-rounded text-sm text-amber-700">key</span>
              <span>PIN: <strong class="font-mono">${escapeHtml(store.pin || '1234')}</strong></span>
            </button>
          </div>
        </div>

        <!-- Omzet & Transaksi Hari Ini -->
        <div class="grid grid-cols-3 gap-2 bg-stone-50 p-2.5 rounded-xl border border-stone-100 text-center text-xs">
          <div>
            <span class="text-[10px] text-stone-500 block font-bold">Omzet Hari Ini</span>
            <span class="font-black text-emerald-800 text-xs sm:text-sm">${formatRupiah(store.todayRevenue || 0)}</span>
          </div>
          <div>
            <span class="text-[10px] text-stone-500 block font-bold">Transaksi</span>
            <span class="font-black text-stone-800 text-xs sm:text-sm">${store.todayTxCount || 0} Trx</span>
          </div>
          <div>
            <span class="text-[10px] text-stone-500 block font-bold">Katalog Menu</span>
            <span class="font-black text-stone-800 text-xs sm:text-sm">${store.productCount || 0} Menu</span>
          </div>
        </div>

        <!-- Action Bar: Impersonate / Masuk Toko, Hubungi WA, Salin Link -->
        <div class="flex items-center justify-between gap-2 pt-1 border-t border-stone-100 flex-wrap">
          <div class="flex items-center gap-2">
            ${store.phone ? `
              <a href="${waLink}" target="_blank" class="text-xs text-emerald-700 font-bold flex items-center gap-1 hover:underline">
                <span class="material-symbols-rounded text-sm">chat</span>
                <span>${escapeHtml(store.phone)}</span>
              </a>
            ` : '<span class="text-[11px] text-stone-400">No WA: -</span>'}
          </div>

          <div class="flex items-center gap-1.5">
            <button onclick="window.KasirApp.impersonateStore('${escapeHtml(store.id)}')"
              class="px-3.5 py-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-black text-xs flex items-center gap-1 shadow-sm transition active:scale-95">
              <span class="material-symbols-rounded text-sm">login</span>
              <span>Buka Kasir</span>
            </button>
          </div>
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
