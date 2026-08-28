/**
 * Kasir Mami - Main Application Entry Point & Module Orchestrator
 */

import { 
  initState, 
  state, 
  getSavedStoresList, 
  registerStoreOnDevice, 
  removeStoreFromDevice, 
  saveStoreAuth, 
  verifyStorePin, 
  setUserRole 
} from './state.js';
import { getStorageKeys, GLOBAL_STORAGE_KEYS } from './config.js';
import { showToast, playClick, escapeHtml, showConfirmDialog } from './utils.js';
import * as pos from './modules/pos.js';
import * as payment from './modules/payment.js';
import * as admin from './modules/admin.js';
import * as report from './modules/report.js';
import { 
  initFirebaseSync, 
  setRemoteUpdateCallback, 
  forceUploadAllToCloud,
  syncSaveStoreAuth,
  syncSaveStoreProfile,
  setupRealtimeListeners,
  unsubscribeAllListeners
} from './firebase.js';

let pendingTargetView = null;

// ================= VIEW NAVIGATION =================
export function switchView(viewName) {
  playClick('switch');

  // Proteksi PIN untuk Menu & Laporan jika diaktifkan oleh pemilik toko
  if ((viewName === 'admin' || viewName === 'report') && state.auth?.requirePinForAdmin && !state.isUnlockedOwner) {
    pendingTargetView = viewName;
    openPinSecurityModal(viewName);
    return;
  }

  const viewPos = document.getElementById('viewPos');
  const viewAdmin = document.getElementById('viewAdmin');
  const viewReport = document.getElementById('viewReport');

  const btnPosM = document.getElementById('btnNavPosMobile') || document.getElementById('btnNavPos');
  const btnReportM = document.getElementById('btnNavReportMobile') || document.getElementById('btnNavReport');
  const btnAdminM = document.getElementById('btnNavAdminMobile') || document.getElementById('btnNavAdmin');
  
  const btnPosD = document.getElementById('btnNavPosDesktop');
  const btnReportD = document.getElementById('btnNavReportDesktop');
  const btnAdminD = document.getElementById('btnNavAdminDesktop');

  // Hide all screens
  if (viewPos) viewPos.classList.add('hidden');
  if (viewAdmin) viewAdmin.classList.add('hidden');
  if (viewReport) viewReport.classList.add('hidden');

  // Reset Mobile Navigation Buttons
  [btnPosM, btnReportM, btnAdminM].forEach(b => {
    if (b) {
      b.className = 'flex flex-col items-center justify-center flex-1 py-1 text-stone-400 hover:text-stone-600 font-medium text-[11px] touch-target-large';
    }
  });

  // Reset Desktop Navigation Buttons
  [btnPosD, btnReportD, btnAdminD].forEach(b => {
    if (b) {
      b.className = 'px-4 py-2 rounded-xl text-stone-700 hover:text-stone-950 hover:bg-white font-extrabold flex items-center gap-2 transition';
    }
  });

  if (viewName === 'pos') {
    if (viewPos) viewPos.classList.remove('hidden');
    if (btnPosM) btnPosM.className = 'flex flex-col items-center justify-center flex-1 py-1 text-emerald-700 font-black text-[11px] touch-target-large';
    if (btnPosD) btnPosD.className = 'px-4 py-2 rounded-xl bg-emerald-700 text-white font-black flex items-center gap-2 transition shadow-sm';
    pos.renderProducts();
    pos.renderCart();
  } else if (viewName === 'admin') {
    if (viewAdmin) viewAdmin.classList.remove('hidden');
    if (btnAdminM) btnAdminM.className = 'flex flex-col items-center justify-center flex-1 py-1 text-emerald-700 font-black text-[11px] touch-target-large';
    if (btnAdminD) btnAdminD.className = 'px-4 py-2 rounded-xl bg-emerald-700 text-white font-black flex items-center gap-2 transition shadow-sm';
    admin.renderAdminTable();
  } else if (viewName === 'report') {
    if (viewReport) viewReport.classList.remove('hidden');
    if (btnReportM) btnReportM.className = 'flex flex-col items-center justify-center flex-1 py-1 text-emerald-700 font-black text-[11px] touch-target-large';
    if (btnReportD) btnReportD.className = 'px-4 py-2 rounded-xl bg-emerald-700 text-white font-black flex items-center gap-2 transition shadow-sm';
    report.renderFinancialReport();
  }
}

// ================= CLOUD SYNC & MULTI-STORE MODAL =================
export function openCloudModal() {
  playClick('pop');
  if (!state.storeId) {
    openUniversalLoginModal('login');
    return;
  }

  const modal = document.getElementById('cloudModal');
  if (modal) {
    const storeDisplay = document.getElementById('cloudStoreIdDisplay');
    const storeNameDisplay = document.getElementById('cloudStoreNameDisplay');
    const storeIdShort = document.getElementById('cloudStoreIdShort');
    const modalStatusEl = document.getElementById('cloudModalStatusText');
    
    if (storeDisplay) {
      storeDisplay.innerText = `${state.storeProfile?.name || 'Toko UMKM'} (${state.storeId})`;
    }
    if (storeNameDisplay) {
      storeNameDisplay.innerText = state.storeProfile?.name || state.storeId;
    }
    if (storeIdShort) {
      storeIdShort.innerText = state.storeId;
    }
    if (modalStatusEl) {
      modalStatusEl.innerHTML = `<span class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span> Online & Terhubung`;
      modalStatusEl.className = 'font-extrabold text-emerald-700 flex items-center gap-1.5';
    }
    updatePinButtonUI();
    modal.classList.remove('hidden');
  }
}

export function closeCloudModal() {
  playClick('pop');
  const modal = document.getElementById('cloudModal');
  if (modal) modal.classList.add('hidden');
}

export function copyStoreShareLink() {
  const baseUrl = window.location.origin + window.location.pathname;
  const storeUrl = `${baseUrl}?store=${encodeURIComponent(state.storeId)}`;
  const storeName = state.storeProfile?.name || 'Kasir UMKM';

  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(storeUrl).then(() => {
      showToast(`Link Toko [${storeName}] berhasil disalin ke clipboard!`, 'success');
    }).catch(() => {
      prompt(`Salin link untuk Toko [${storeName}]:`, storeUrl);
    });
  } else {
    prompt(`Salin link untuk Toko [${storeName}]:`, storeUrl);
  }
}

export function switchStore(newStoreId) {
  if (!newStoreId) return;
  const cleanId = newStoreId.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '_');
  if (cleanId) {
    const baseUrl = window.location.origin + window.location.pathname;
    window.location.href = `${baseUrl}?store=${encodeURIComponent(cleanId)}`;
  }
}

// ================= UNIVERSAL LOGIN & REGISTRATION =================
export function openUniversalLoginModal(defaultTab = 'login') {
  playClick('pop');
  const modal = document.getElementById('universalLoginModal');
  if (!modal) return;

  switchAuthTab(defaultTab);
  renderSavedStoresList();
  modal.classList.remove('hidden');
}

export function closeUniversalLoginModal() {
  playClick('pop');
  const modal = document.getElementById('universalLoginModal');
  if (modal) modal.classList.add('hidden');
}

export function switchAuthTab(tab) {
  playClick('pop');
  const tabLogin = document.getElementById('authTabLogin');
  const tabRegister = document.getElementById('authTabRegister');
  const contentLogin = document.getElementById('authContentLogin');
  const contentRegister = document.getElementById('authContentRegister');

  if (tab === 'login') {
    if (tabLogin) tabLogin.className = 'flex-1 py-2 rounded-lg text-xs font-black transition bg-emerald-600 text-white shadow-sm';
    if (tabRegister) tabRegister.className = 'flex-1 py-2 rounded-lg text-xs font-bold transition text-emerald-300 hover:text-white';
    if (contentLogin) contentLogin.classList.remove('hidden');
    if (contentRegister) contentRegister.classList.add('hidden');
    renderSavedStoresList();
  } else {
    if (tabLogin) tabLogin.className = 'flex-1 py-2 rounded-lg text-xs font-bold transition text-emerald-300 hover:text-white';
    if (tabRegister) tabRegister.className = 'flex-1 py-2 rounded-lg text-xs font-black transition bg-emerald-600 text-white shadow-sm';
    if (contentLogin) contentLogin.classList.add('hidden');
    if (contentRegister) contentRegister.classList.remove('hidden');
  }
}

export function renderSavedStoresList() {
  const container = document.getElementById('savedStoresList');
  if (!container) return;

  const stores = getSavedStoresList();
  if (stores.length === 0) {
    container.innerHTML = `
      <p class="text-xs text-stone-400 italic py-2 text-center">Belum ada toko tersimpan di perangkat ini.</p>
    `;
    return;
  }

  container.innerHTML = stores.map(s => {
    const isCurrent = state.isSessionActive && s.id === state.storeId;
    return `
      <div class="flex items-center justify-between p-2.5 rounded-xl border ${isCurrent ? 'bg-emerald-50 border-emerald-300' : 'bg-white border-stone-200 hover:border-emerald-200'} transition">
        <div class="flex items-center gap-2.5 cursor-pointer flex-1 min-w-0" onclick="quickSelectStore('${escapeHtml(s.id)}')">
          <div class="w-8 h-8 rounded-lg ${isCurrent ? 'bg-emerald-700 text-white' : 'bg-stone-100 text-stone-700'} flex items-center justify-center font-black text-xs shrink-0">
            <span class="material-symbols-rounded text-lg">storefront</span>
          </div>
          <div class="min-w-0">
            <h5 class="text-xs font-black text-stone-900 truncate">${escapeHtml(s.name)}</h5>
            <p class="text-[10px] text-stone-500 truncate">${escapeHtml(s.id)} ${s.ownerName ? `• ${escapeHtml(s.ownerName)}` : ''}</p>
          </div>
        </div>
        <div class="flex items-center gap-1.5 shrink-0">
          <button type="button" onclick="quickSelectStore('${escapeHtml(s.id)}')"
            class="px-2.5 py-1 rounded-lg ${isCurrent ? 'bg-emerald-700 text-white' : 'bg-stone-100 hover:bg-emerald-100 text-stone-800'} font-bold text-[11px] transition">
            ${isCurrent ? 'Aktif' : 'Buka'}
          </button>
          <button type="button" onclick="deleteSavedStoreCard('${escapeHtml(s.id)}')" title="Hapus dari daftar cepat"
            class="p-1 text-stone-400 hover:text-rose-600 rounded-md transition">
            <span class="material-symbols-rounded text-base">delete</span>
          </button>
        </div>
      </div>
    `;
  }).join('');
}

export function quickSelectStore(storeId) {
  if (!storeId) return;
  const cleanId = storeId.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '_');
  if (!cleanId) return;

  sessionStorage.removeItem('is_logged_out_state');
  localStorage.setItem(GLOBAL_STORAGE_KEYS.ACTIVE_STORE_ID, cleanId);
  window.history.replaceState(null, '', `${window.location.pathname}?store=${encodeURIComponent(cleanId)}`);

  state.storeId = cleanId;
  state.isSessionActive = true;
  initState();
  setupRealtimeListeners();
  pos.renderProducts();
  pos.renderCart();
  pos.renderOrderQueueTabs();
  admin.renderAdminTable();
  report.renderFinancialReport();
  updatePinButtonUI();
  closeUniversalLoginModal();
  showToast(`Kasir [${state.storeProfile?.name || cleanId}] siap melayani`, 'success');
}

export function deleteSavedStoreCard(storeId) {
  removeStoreFromDevice(storeId);
  if (state.storeId === storeId) {
    unsubscribeAllListeners();
    state.storeId = null;
    state.isSessionActive = false;
    localStorage.removeItem(GLOBAL_STORAGE_KEYS.ACTIVE_STORE_ID);
    sessionStorage.setItem('is_logged_out_state', '1');
    window.history.replaceState(null, '', window.location.pathname);
    initState();
    pos.renderProducts();
    pos.renderCart();
    pos.renderOrderQueueTabs();
  }
  renderSavedStoresList();
  showToast('Toko dihapus dari daftar perangkat.', 'info');
}

export function handleStoreLoginSubmit(e) {
  if (e) e.preventDefault();
  const input = document.getElementById('loginStoreIdInput');
  let rawValue = input ? input.value.trim() : '';
  if (!rawValue) return;

  // Jika user mem-paste URL lengkap (?store=nama_toko)
  if (rawValue.includes('?store=')) {
    try {
      const url = new URL(rawValue);
      const sp = url.searchParams.get('store');
      if (sp) rawValue = sp;
    } catch (err) {
      const match = rawValue.match(/\?store=([^&]+)/);
      if (match && match[1]) rawValue = match[1];
    }
  }

  const cleanId = rawValue.toLowerCase().replace(/[^a-z0-9_-]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
  if (!cleanId) {
    showToast('Harap masukkan nama / ID toko dengan benar', 'warning');
    return;
  }

  registerStoreOnDevice({
    id: cleanId,
    name: cleanId.replace(/_/g, ' ').toUpperCase()
  });

  quickSelectStore(cleanId);
}

export function handleStoreRegisterSubmit(e) {
  if (e) e.preventDefault();
  const nameInput = document.getElementById('regStoreName');
  const ownerInput = document.getElementById('regOwnerName');
  const phoneInput = document.getElementById('regPhone');
  const pinInput = document.getElementById('regPin');

  const storeName = nameInput ? nameInput.value.trim() : '';
  const ownerName = ownerInput ? ownerInput.value.trim() : '';
  const phone = phoneInput ? phoneInput.value.trim() : '';
  const pin = pinInput ? pinInput.value.trim() : '1234';

  if (!storeName || !ownerName || !phone) {
    showToast('Harap lengkapi semua kolom pendaftaran toko', 'warning');
    return;
  }

  const cleanId = storeName.toLowerCase().replace(/[^a-z0-9]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
  if (!cleanId) {
    showToast('Nama toko tidak valid', 'warning');
    return;
  }

  const newKeys = getStorageKeys(cleanId);
  const newProfile = {
    id: cleanId,
    name: storeName,
    city: 'Indonesia',
    nmid: '',
    acquirer: 'Aristotle POS'
  };

  const newAuth = {
    pin: pin || '1234',
    ownerName,
    phone,
    requirePinForAdmin: false
  };

  try {
    localStorage.setItem(newKeys.PROFILE, JSON.stringify(newProfile));
    localStorage.setItem(newKeys.AUTH, JSON.stringify(newAuth));
    localStorage.setItem(GLOBAL_STORAGE_KEYS.ACTIVE_STORE_ID, cleanId);
    registerStoreOnDevice({
      id: cleanId,
      name: storeName,
      ownerName,
      phone
    });
  } catch (err) {}

  quickSelectStore(cleanId);
  syncSaveStoreProfile(newProfile);
  syncSaveStoreAuth(newAuth);
  showToast(`Toko [${storeName}] berhasil didaftarkan & dibuka!`, 'success');
}

// ================= PIN SECURITY & ROLE MANAGEMENT =================
export function openPinSecurityModal(targetView) {
  playClick('pop');
  const modal = document.getElementById('pinSecurityModal');
  const input = document.getElementById('pinSecurityInput');
  const subtitle = document.getElementById('pinChallengeSubtitle');
  
  if (subtitle) {
    const viewLabel = targetView === 'admin' ? 'Kelola Menu & Harga' : 'Laporan Keuangan & Laba';
    subtitle.innerText = `Masukkan 4 digit PIN Owner untuk membuka ${viewLabel}`;
  }

  if (input) input.value = '';
  if (modal) modal.classList.remove('hidden');
  if (input) {
    requestAnimationFrame(() => input.focus());
  }
}

export function closePinSecurityModal() {
  playClick('pop');
  pendingTargetView = null;
  const modal = document.getElementById('pinSecurityModal');
  if (modal) modal.classList.add('hidden');
}

export function handlePinSecuritySubmit(e) {
  if (e) e.preventDefault();
  const input = document.getElementById('pinSecurityInput');
  const entered = input ? input.value.trim() : '';

  if (verifyStorePin(entered)) {
    state.isUnlockedOwner = true;
    closePinSecurityModal();
    showToast('PIN Berhasil! Akses Owner terbuka.', 'success');
    if (pendingTargetView) {
      const v = pendingTargetView;
      pendingTargetView = null;
      switchView(v);
    }
  } else {
    showToast('PIN salah! Akses ditolak.', 'danger');
    if (input) {
      input.value = '';
      input.focus();
    }
  }
}

export function togglePinProtectionSetting() {
  playClick('pop');
  state.auth.requirePinForAdmin = !state.auth.requirePinForAdmin;
  saveStoreAuth(state.auth);
  syncSaveStoreAuth(state.auth);
  updatePinButtonUI();

  if (state.auth.requirePinForAdmin) {
    state.isUnlockedOwner = false;
    showToast('Proteksi PIN aktif: Menu Admin & Laporan dikunci untuk staf.', 'success');
  } else {
    state.isUnlockedOwner = true;
    showToast('Proteksi PIN dinonaktifkan.', 'info');
  }
}

function updatePinButtonUI() {
  const btn = document.getElementById('btnTogglePinSetting');
  if (btn) {
    if (state.auth?.requirePinForAdmin) {
      btn.innerText = 'Aktif (Terkunci)';
      btn.className = 'px-3 py-1.5 rounded-lg bg-emerald-600 text-white font-black text-[11px] transition shadow-sm';
    } else {
      btn.innerText = 'Nonaktif';
      btn.className = 'px-3 py-1.5 rounded-lg bg-stone-200 text-stone-700 font-black text-[11px] hover:bg-emerald-100 hover:text-emerald-800 transition';
    }
  }
}

export async function logoutStore() {
  playClick('pop');
  closeCloudModal();
  const storeName = state.storeProfile?.name || state.storeId || 'Toko';
  const ok = await showConfirmDialog({
    title: 'Keluar dari Toko',
    message: `Keluar dari toko "${storeName}"? Sesi kasir di perangkat ini akan ditutup dan Anda bisa memilih atau mendaftarkan toko lain.`,
    confirmText: 'Ya, Keluar Toko',
    confirmType: 'danger',
    icon: 'logout'
  });

  if (ok) {
    try {
      unsubscribeAllListeners();
      localStorage.removeItem(GLOBAL_STORAGE_KEYS.ACTIVE_STORE_ID);
      sessionStorage.setItem('is_logged_out_state', '1');
    } catch (err) {}

    state.storeId = null;
    state.isSessionActive = false;
    initState();
    window.history.replaceState(null, '', window.location.pathname);
    pos.renderProducts();
    pos.renderCart();
    pos.renderOrderQueueTabs();
    admin.renderAdminTable();
    report.renderFinancialReport();
    updatePinButtonUI();
    openUniversalLoginModal('login');
    showToast(`Berhasil keluar dari ${storeName}. Silakan pilih atau daftarkan toko.`, 'info');
  }
}

export function forceSyncCloud() {
  forceUploadAllToCloud();
}

// ================= SERVICE WORKER REGISTRATION =================
function registerSW() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  }
}

// ================= APP INITIALIZATION =================
function dismissSplashScreen() {
  const splash = document.getElementById('appSplashScreen');
  if (splash) {
    setTimeout(() => {
      splash.classList.add('splash-hidden');
      setTimeout(() => {
        splash.style.display = 'none';
      }, 450);
    }, 400);
  }
}

export function init() {
  // 1. Initial skeleton preview if DOM not populated
  pos.renderProductSkeletons(8);

  // 2. Instant load from local storage
  initState();
  pos.renderOrderQueueTabs();
  pos.renderProducts();
  pos.renderCart();

  // 3. Setup Service Worker for offline PWA
  registerSW();

  // 4. Setup Firebase Realtime Cloud Sync (Smart Smooth Live Update)
  setRemoteUpdateCallback((type) => {
    const viewPos = document.getElementById('viewPos');
    const viewAdmin = document.getElementById('viewAdmin');
    const viewReport = document.getElementById('viewReport');

    if (type === 'products') {
      if (viewPos && !viewPos.classList.contains('hidden')) {
        pos.renderProducts();
        pos.renderCart();
      }
      if (viewAdmin && !viewAdmin.classList.contains('hidden')) {
        admin.renderAdminTable();
      }
    } else if (type === 'transactions' || type === 'expenses') {
      if (viewReport && !viewReport.classList.contains('hidden')) {
        report.renderFinancialReport();
      }
    } else if (type === 'queues') {
      if (viewPos && !viewPos.classList.contains('hidden')) {
        pos.renderOrderQueueTabs();
        pos.renderCart();
      }
    }
  });

  initFirebaseSync();

  // 5. Dismiss Splash Screen smoothly
  dismissSplashScreen();

  // If no store is active or logged out -> Auto open store selector
  if (!state.storeId || sessionStorage.getItem('is_logged_out_state') === '1') {
    setTimeout(() => {
      openUniversalLoginModal('login');
      if (sessionStorage.getItem('is_logged_out_state') === '1') {
        showToast('Sesi kasir ditutup. Silakan pilih atau daftarkan toko.', 'info');
      }
    }, 400);
  } else {
    // Welcome Toast Notification
    setTimeout(() => {
      showToast(`Kasir [${state.storeProfile?.name || 'Toko'}] siap melayani`, 'success', 2500);
    }, 700);
  }
}

// ================= EXPORT GLOBAL NAMESPACE FOR HTML HANDLERS =================
const KasirApp = {
  // App & Multi-Store & Universal Auth
  init,
  switchView,
  openCloudModal,
  closeCloudModal,
  copyStoreShareLink,
  switchStore,
  logoutStore,
  openUniversalLoginModal,
  closeUniversalLoginModal,
  switchAuthTab,
  renderSavedStoresList,
  quickSelectStore,
  deleteSavedStoreCard,
  handleStoreLoginSubmit,
  handleStoreRegisterSubmit,
  openPinSecurityModal,
  closePinSecurityModal,
  handlePinSecuritySubmit,
  togglePinProtectionSetting,
  forceSyncCloud,
  showToast,

  // POS & Queue Modals
  renderOrderQueueTabs: pos.renderOrderQueueTabs,
  addNewOrderQueue: pos.addNewOrderQueue,
  switchOrderQueue: pos.switchOrderQueue,
  promptRenameQueue: pos.promptRenameQueue,
  openRenameQueueModal: pos.openRenameQueueModal,
  closeRenameQueueModal: pos.closeRenameQueueModal,
  setPresetQueueName: pos.setPresetQueueName,
  saveQueueRename: pos.saveQueueRename,
  deleteCurrentActiveQueue: pos.deleteCurrentActiveQueue,
  deleteOrderQueue: pos.deleteOrderQueue,
  scrollQueueTabs: pos.scrollQueueTabs,
  handleQueueWheel: pos.handleQueueWheel,
  setCategory: pos.setCategory,
  renderProducts: pos.renderProducts,
  renderProductSkeletons: pos.renderProductSkeletons,
  addToCart: pos.addToCart,
  updateCartQty: pos.updateCartQty,
  confirmClearCart: pos.confirmClearCart,
  renderCart: pos.renderCart,
  toggleMobileCartDrawer: pos.toggleMobileCartDrawer,

  // Payment & QRIS
  openPaymentModal: payment.openPaymentModal,
  closePaymentModal: payment.closePaymentModal,
  setPaymentMethod: payment.setPaymentMethod,
  calculateSplitBill: payment.calculateSplitBill,
  resetSplitBill: payment.resetSplitBill,
  selectQuickCash: payment.selectQuickCash,
  toggleCustomKeypad: payment.toggleCustomKeypad,
  handleManualCashInput: payment.handleManualCashInput,
  addKeypadDigit: payment.addKeypadDigit,
  backspaceKeypad: payment.backspaceKeypad,
  clearManualCash: payment.clearManualCash,
  completeTransaction: payment.completeTransaction,
  showReceipt: payment.showReceipt,
  closeReceiptModal: payment.closeReceiptModal,
  toggleQrisPaymentMode: payment.toggleQrisPaymentMode,

  // Admin & Backup & QRIS & Menu
  renderAdminTable: admin.renderAdminTable,
  openAddProductModal: admin.openAddProductModal,
  openEditProductModal: admin.openEditProductModal,
  closeProductModal: admin.closeProductModal,
  saveProduct: admin.saveProduct,
  deleteProduct: admin.deleteProduct,
  toggleProductAvailability: admin.toggleProductAvailability,
  openQrisModal: admin.openQrisModal,
  closeQrisModal: admin.closeQrisModal,
  handleQrisImageUpload: admin.handleQrisImageUpload,
  saveQrisSettings: admin.saveQrisSettings,
  exportDataBackup: admin.exportDataBackup,
  importDataBackup: admin.importDataBackup,

  // Report & Bookkeeping
  setReportPeriod: report.setReportPeriod,
  renderFinancialReport: report.renderFinancialReport,
  openExpenseModal: report.openExpenseModal,
  closeExpenseModal: report.closeExpenseModal,
  saveExpense: report.saveExpense,
  deleteExpense: report.deleteExpense,
  deleteTransaction: report.deleteTransaction,
  clearTodayData: report.clearTodayData,
  clearAllHistory: report.clearAllHistory,
  clearTransactionHistory: report.clearTransactionHistory,
  shareReportWhatsApp: report.shareReportWhatsApp,
  exportReportCSV: report.exportReportCSV,
  reprintTx: report.reprintTx
};

// Expose to window for inline onclick HTML handlers
window.KasirApp = KasirApp;

// Auto-bind window shortcuts for standard HTML event handlers
Object.keys(KasirApp).forEach(key => {
  if (typeof window[key] === 'undefined') {
    window[key] = KasirApp[key];
  }
});

// Auto-start on DOMContentLoaded
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
