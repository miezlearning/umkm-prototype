/**
 * Kasir Mami - Main Application Entry Point & Module Orchestrator
 */

import { initState, state } from './state.js';
import { showToast } from './utils.js';
import * as pos from './modules/pos.js';
import * as payment from './modules/payment.js';
import * as admin from './modules/admin.js';
import * as report from './modules/report.js';
import { 
  initFirebaseSync, 
  setRemoteUpdateCallback, 
  forceUploadAllToCloud,
  STORE_ID 
} from './firebase.js';

// ================= VIEW NAVIGATION =================
export function switchView(viewName) {
  const viewPos = document.getElementById('viewPos');
  const viewAdmin = document.getElementById('viewAdmin');
  const viewReport = document.getElementById('viewReport');

  const btnPos = document.getElementById('btnNavPos');
  const btnReport = document.getElementById('btnNavReport');
  const btnAdmin = document.getElementById('btnNavAdmin');
  const btnPosD = document.getElementById('btnNavPosDesktop');
  const btnReportD = document.getElementById('btnNavReportDesktop');
  const btnAdminD = document.getElementById('btnNavAdminDesktop');

  // Hide all screens
  if (viewPos) viewPos.classList.add('hidden');
  if (viewAdmin) viewAdmin.classList.add('hidden');
  if (viewReport) viewReport.classList.add('hidden');

  // Reset Mobile Navigation Buttons
  [btnPos, btnReport, btnAdmin].forEach(b => {
    if (b) {
      b.className = 'flex flex-col items-center justify-center flex-1 py-1.5 text-stone-500 hover:text-stone-900 transition touch-target-large';
    }
  });

  // Reset Desktop Navigation Buttons
  [btnPosD, btnReportD, btnAdminD].forEach(b => {
    if (b) {
      b.className = 'px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-stone-300 hover:text-white font-bold flex items-center gap-2 transition touch-target-large';
    }
  });

  if (viewName === 'pos') {
    if (viewPos) viewPos.classList.remove('hidden');
    if (btnPos) btnPos.className = 'flex flex-col items-center justify-center flex-1 py-1.5 text-emerald-700 font-extrabold transition touch-target-large';
    if (btnPosD) btnPosD.className = 'px-4 py-2 rounded-xl bg-emerald-500/20 text-emerald-300 font-black flex items-center gap-2 transition touch-target-large ring-1 ring-emerald-500/40';
    pos.renderProducts();
    pos.renderCart();
  } else if (viewName === 'admin') {
    if (viewAdmin) viewAdmin.classList.remove('hidden');
    if (btnAdmin) btnAdmin.className = 'flex flex-col items-center justify-center flex-1 py-1.5 text-emerald-700 font-extrabold transition touch-target-large';
    if (btnAdminD) btnAdminD.className = 'px-4 py-2 rounded-xl bg-emerald-500/20 text-emerald-300 font-black flex items-center gap-2 transition touch-target-large ring-1 ring-emerald-500/40';
    admin.renderAdminTable();
  } else if (viewName === 'report') {
    if (viewReport) viewReport.classList.remove('hidden');
    if (btnReport) btnReport.className = 'flex flex-col items-center justify-center flex-1 py-1.5 text-emerald-700 font-extrabold transition touch-target-large';
    if (btnReportD) btnReportD.className = 'px-4 py-2 rounded-xl bg-emerald-500/20 text-emerald-300 font-black flex items-center gap-2 transition touch-target-large ring-1 ring-emerald-500/40';
    report.renderFinancialReport();
  }
}

// ================= CLOUD SYNC & MULTI-STORE MODAL =================
export function openCloudModal() {
  const modal = document.getElementById('cloudModal');
  if (modal) {
    const storeDisplay = document.getElementById('cloudStoreIdDisplay');
    if (storeDisplay) {
      storeDisplay.innerText = `${state.storeProfile?.name || 'Toko UMKM'} (${state.storeId})`;
    }
    modal.classList.remove('hidden');
  }
}

export function closeCloudModal() {
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

export function promptCreateNewStore() {
  openCreateStoreModal();
}

export function openCreateStoreModal() {
  const modal = document.getElementById('createStoreModal');
  const input = document.getElementById('newStoreNameInput');
  if (input) input.value = '';
  if (modal) modal.classList.remove('hidden');
  if (input) setTimeout(() => input.focus(), 100);
}

export function closeCreateStoreModal() {
  const modal = document.getElementById('createStoreModal');
  if (modal) modal.classList.add('hidden');
}

export function saveNewStoreCreation(e) {
  if (e) e.preventDefault();
  const input = document.getElementById('newStoreNameInput');
  const storeName = input ? input.value.trim() : '';
  if (!storeName) return;

  const cleanId = storeName.toLowerCase().replace(/[^a-z0-9]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
  if (cleanId) {
    const baseUrl = window.location.origin + window.location.pathname;
    closeCreateStoreModal();
    showToast(`Membuka toko baru: ${storeName}...`, 'success');
    setTimeout(() => {
      window.location.href = `${baseUrl}?store=${encodeURIComponent(cleanId)}`;
    }, 600);
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
export function init() {
  // 1. Instant load from local storage (0ms first paint)
  initState();
  pos.renderOrderQueueTabs();
  pos.renderProducts();
  pos.renderCart();

  // 2. Setup Service Worker for offline PWA
  registerSW();

  // 3. Setup Firebase Realtime Cloud Sync
  setRemoteUpdateCallback((type) => {
    if (type === 'products') {
      pos.renderProducts();
      admin.renderAdminTable();
      pos.renderCart();
    } else if (type === 'transactions' || type === 'expenses') {
      report.renderFinancialReport();
    } else if (type === 'queues') {
      pos.renderOrderQueueTabs();
      pos.renderCart();
      pos.renderProducts();
    }
  });

  initFirebaseSync();

  // Welcome Toast Notification
  setTimeout(() => {
    showToast(`Kasir [${state.storeProfile?.name || 'Toko'}] siap melayani`, 'success', 2500);
  }, 400);
}

// ================= EXPORT GLOBAL NAMESPACE FOR HTML HANDLERS =================
const KasirApp = {
  // App & Multi-Store
  init,
  switchView,
  openCloudModal,
  closeCloudModal,
  copyStoreShareLink,
  switchStore,
  promptCreateNewStore,
  openCreateStoreModal,
  closeCreateStoreModal,
  saveNewStoreCreation,
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

  // Admin & Backup & QRIS & Stock
  renderAdminTable: admin.renderAdminTable,
  openAddProductModal: admin.openAddProductModal,
  openEditProductModal: admin.openEditProductModal,
  closeProductModal: admin.closeProductModal,
  saveProduct: admin.saveProduct,
  deleteProduct: admin.deleteProduct,
  toggleProductAvailability: admin.toggleProductAvailability,
  toggleTrackStockInput: admin.toggleTrackStockInput,
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
