/**
 * Kasir Mami - Main Application Entry Point & Module Orchestrator
 */

import { initState } from './state.js';
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

  if (viewPos) viewPos.classList.toggle('hidden', viewName !== 'pos');
  if (viewAdmin) viewAdmin.classList.toggle('hidden', viewName !== 'admin');
  if (viewReport) viewReport.classList.toggle('hidden', viewName !== 'report');

  ['pos', 'admin', 'report'].forEach(v => {
    const deskBtn = document.getElementById(`btnNav${v.charAt(0).toUpperCase() + v.slice(1)}Desktop`);
    if (deskBtn) {
      deskBtn.className = (v === viewName)
        ? 'px-4 py-2 rounded-xl bg-amber-500/20 text-amber-300 font-black flex items-center gap-2 transition touch-target-large ring-1 ring-amber-500/40'
        : 'px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-stone-300 hover:text-white font-bold flex items-center gap-2 transition touch-target-large';
    }
    
    const mobBtn = document.getElementById(`btnNav${v.charAt(0).toUpperCase() + v.slice(1)}Mobile`);
    if (mobBtn) {
      mobBtn.className = (v === viewName)
        ? 'flex flex-col items-center justify-center flex-1 py-1 text-amber-600 font-black text-[11px] touch-target-large'
        : 'flex flex-col items-center justify-center flex-1 py-1 text-stone-400 hover:text-stone-600 font-medium text-[11px] touch-target-large';
    }
  });

  if (viewName === 'admin') admin.renderAdminTable();
  if (viewName === 'report') report.renderFinancialReport();
  if (viewName === 'pos') pos.renderProducts();
}

// ================= CLOUD MODAL HELPERS =================
export function openCloudModal() {
  const modal = document.getElementById('cloudModal');
  if (modal) modal.classList.remove('hidden');
}

export function closeCloudModal() {
  const modal = document.getElementById('cloudModal');
  if (modal) modal.classList.add('hidden');
}

export function copyStoreShareLink() {
  const url = window.location.href.split('#')[0];
  if (navigator.clipboard) {
    navigator.clipboard.writeText(url).then(() => {
      alert(`✓ Link Toko berhasil disalin!\n\n${url}\n\nKirimkan link ini ke WhatsApp HP Mami / Karyawan untuk langsung terhubung.`);
    }).catch(() => {
      prompt('Salin link ini untuk HP Mami:', url);
    });
  } else {
    prompt('Salin link ini untuk HP Mami:', url);
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
}

// ================= EXPORT GLOBAL NAMESPACE FOR HTML HANDLERS =================
const KasirApp = {
  // App
  init,
  switchView,
  openCloudModal,
  closeCloudModal,
  copyStoreShareLink,
  forceSyncCloud,

  // POS
  renderOrderQueueTabs: pos.renderOrderQueueTabs,
  addNewOrderQueue: pos.addNewOrderQueue,
  switchOrderQueue: pos.switchOrderQueue,
  promptRenameQueue: pos.promptRenameQueue,
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

  // Payment
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

  // Admin & Backup
  renderAdminTable: admin.renderAdminTable,
  openAddProductModal: admin.openAddProductModal,
  openEditProductModal: admin.openEditProductModal,
  closeProductModal: admin.closeProductModal,
  saveProduct: admin.saveProduct,
  deleteProduct: admin.deleteProduct,
  exportDataBackup: admin.exportDataBackup,
  importDataBackup: admin.importDataBackup,

  // Reports & Data Deletion
  setReportPeriod: report.setReportPeriod,
  renderFinancialReport: report.renderFinancialReport,
  openExpenseModal: report.openExpenseModal,
  closeExpenseModal: report.closeExpenseModal,
  saveExpense: report.saveExpense,
  deleteExpense: report.deleteExpense,
  shareReportWhatsApp: report.shareReportWhatsApp,
  exportReportCSV: report.exportReportCSV,
  clearTransactionHistory: report.clearTransactionHistory,
  clearTodayData: report.clearTodayData,
  deleteTransaction: report.deleteTransaction,
  clearAllHistory: report.clearAllHistory,
  reprintTx: report.reprintTx
};

window.KasirApp = KasirApp;

// Attach to window object for seamless inline HTML onclick/onsubmit attributes
Object.keys(KasirApp).forEach(fnKey => {
  window[fnKey] = KasirApp[fnKey];
});

// Run init on DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
