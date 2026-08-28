/**
 * Kasir Mami - Central State Management & Multi-Tenant Storage
 */

import { getStorageKeys, DEFAULT_PRODUCTS, DEFAULT_QRIS_PAYLOAD, DEFAULT_STORE_PROFILE } from './config.js';
import { parseQRISMetadata } from './qris.js';

/**
 * Deteksi Store ID dari URL query string (?store=...) atau localStorage
 */
export function resolveActiveStoreId() {
  try {
    const params = new URLSearchParams(window.location.search);
    const storeParam = params.get('store');
    if (storeParam && storeParam.trim()) {
      const sanitized = storeParam.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '_');
      localStorage.setItem('kasir_active_store_id', sanitized);
      return sanitized;
    }
  } catch (e) {}

  return localStorage.getItem('kasir_active_store_id') || 'kedai_usaha_mami';
}

export const activeStoreId = resolveActiveStoreId();
export const currentStorageKeys = getStorageKeys(activeStoreId);

export const state = {
  storeId: activeStoreId,
  storeProfile: { ...DEFAULT_STORE_PROFILE, id: activeStoreId },
  products: [],
  transactions: [],
  expenses: [],
  orderQueues: [
    { id: 'q_1', name: 'Pesanan #1', cart: {} }
  ],
  activeQueueId: 'q_1',
  currentCategory: 'all',
  currentPeriod: 'today', // 'today', 'month', 'all'
  qrisPayload: DEFAULT_QRIS_PAYLOAD,
  qrisMode: 'dynamic' // 'dynamic' (nominal pas otomatis) or 'static' (nominal manual)
};

/**
 * Muat seluruh data dari LocalStorage ke State
 */
export function initState() {
  const keys = currentStorageKeys;

  // 1. Muat QRIS Payload & Ekstrak Profil Toko
  const savedQris = localStorage.getItem(keys.QRIS);
  if (savedQris && savedQris.trim()) {
    state.qrisPayload = savedQris.trim();
  } else {
    state.qrisPayload = DEFAULT_QRIS_PAYLOAD;
  }

  // 2. Muat Profil Toko (atau ekstrak dari QRIS)
  const savedProfile = localStorage.getItem(keys.PROFILE);
  if (savedProfile) {
    try {
      state.storeProfile = { ...DEFAULT_STORE_PROFILE, ...JSON.parse(savedProfile), id: state.storeId };
    } catch (e) {
      state.storeProfile = { ...DEFAULT_STORE_PROFILE, id: state.storeId };
    }
  } else {
    // Auto-ekstrak dari payload QRIS
    const meta = parseQRISMetadata(state.qrisPayload);
    state.storeProfile = {
      id: state.storeId,
      name: meta.merchantName || 'Kedai Usaha Mami',
      city: meta.city || 'Samarinda (Kota)',
      nmid: meta.nmid || 'ID1025450522335',
      acquirer: meta.acquirer || "Livin' by Mandiri"
    };
    saveStoreProfile();
  }

  // 3. Muat Produk
  const savedProducts = localStorage.getItem(keys.PRODUCTS);
  if (savedProducts) {
    try {
      state.products = JSON.parse(savedProducts);
    } catch (e) {
      state.products = [...DEFAULT_PRODUCTS];
    }
  } else {
    state.products = [...DEFAULT_PRODUCTS];
    saveProducts();
  }

  // 4. Muat Transaksi
  const savedHistory = localStorage.getItem(keys.HISTORY);
  if (savedHistory) {
    try {
      state.transactions = JSON.parse(savedHistory);
    } catch (e) {
      state.transactions = [];
    }
  }

  // 5. Muat Pengeluaran
  const savedExpenses = localStorage.getItem(keys.EXPENSES);
  if (savedExpenses) {
    try {
      state.expenses = JSON.parse(savedExpenses);
    } catch (e) {
      state.expenses = [];
    }
  }

  // 6. Muat Antrian Pesanan
  const savedQueues = localStorage.getItem(keys.QUEUES);
  if (savedQueues) {
    try {
      state.orderQueues = JSON.parse(savedQueues);
      if (!state.orderQueues.length) {
        state.orderQueues = [{ id: 'q_1', name: 'Pesanan #1', cart: {} }];
      }
      if (!state.orderQueues.some(q => q.id === state.activeQueueId)) {
        state.activeQueueId = state.orderQueues[0].id;
      }
    } catch (e) {
      state.orderQueues = [{ id: 'q_1', name: 'Pesanan #1', cart: {} }];
    }
  }

  if (
    state.orderQueues.length === 1 &&
    Object.keys(state.orderQueues[0].cart).length === 0 &&
    state.orderQueues[0].name.startsWith('Pesanan #')
  ) {
    state.orderQueues[0].name = 'Pesanan #1';
  }

  // Update UI Elements with Store Branding
  updateUIStoreBranding();
}

/**
 * Perbarui teks nama toko & branding di seluruh layar (Header, struk, laporan)
 */
export function updateUIStoreBranding() {
  const storeName = state.storeProfile?.name || 'Kedai Usaha Mami';
  const nmid = state.storeProfile?.nmid || '';

  // Header Title
  const headerTitleEl = document.getElementById('appHeaderStoreTitle') || document.querySelector('header h1');
  if (headerTitleEl) headerTitleEl.innerText = storeName;

  // Struk Header
  const receiptStoreNameEl = document.getElementById('receiptStoreName');
  if (receiptStoreNameEl) receiptStoreNameEl.innerText = storeName;

  // QRIS Payment Card Merchant Info
  const qrisMerchantNameEl = document.getElementById('qrisMerchantName');
  if (qrisMerchantNameEl) qrisMerchantNameEl.innerText = storeName;

  const qrisNmidEl = document.getElementById('qrisNmidDisplay');
  if (qrisNmidEl) {
    qrisNmidEl.innerText = nmid ? `NMID: ${nmid}` : '';
  }

  // Cloud Store Indicator
  const cloudStoreNameDisplay = document.getElementById('cloudStoreNameDisplay');
  if (cloudStoreNameDisplay) {
    cloudStoreNameDisplay.innerText = storeName;
  }
  const cloudStoreIdEl = document.getElementById('cloudStoreIdDisplay');
  if (cloudStoreIdEl) {
    cloudStoreIdEl.innerText = `${storeName} (${state.storeId})`;
  }
}

export function saveStoreProfile(profile) {
  if (profile) {
    state.storeProfile = { ...state.storeProfile, ...profile };
  }
  localStorage.setItem(currentStorageKeys.PROFILE, JSON.stringify(state.storeProfile));
  updateUIStoreBranding();
}

export function saveProducts() {
  localStorage.setItem(currentStorageKeys.PRODUCTS, JSON.stringify(state.products));
}

export function saveHistory() {
  localStorage.setItem(currentStorageKeys.HISTORY, JSON.stringify(state.transactions));
}

export function saveExpenses() {
  localStorage.setItem(currentStorageKeys.EXPENSES, JSON.stringify(state.expenses));
}

export function saveQueues() {
  localStorage.setItem(currentStorageKeys.QUEUES, JSON.stringify(state.orderQueues));
}

export function saveQrisPayload(payload) {
  state.qrisPayload = (payload || DEFAULT_QRIS_PAYLOAD).trim();
  localStorage.setItem(currentStorageKeys.QRIS, state.qrisPayload);

  // Otomatis sinkronkan profil toko dari metadata QRIS yang baru
  const meta = parseQRISMetadata(state.qrisPayload);
  if (meta && meta.merchantName) {
    state.storeProfile.name = meta.merchantName;
    state.storeProfile.city = meta.city;
    state.storeProfile.nmid = meta.nmid;
    state.storeProfile.acquirer = meta.acquirer;
    saveStoreProfile();
  }
}

/**
 * Dapatkan objek keranjang antrian yang aktif saat ini
 */
export function getCurrentCart() {
  const q = state.orderQueues.find(item => item.id === state.activeQueueId);
  return q ? q.cart : {};
}

/**
 * Dapatkan data antrian aktif
 */
export function getActiveQueue() {
  return state.orderQueues.find(q => q.id === state.activeQueueId);
}

/**
 * Hitung total harga dan jumlah item di keranjang aktif
 */
export function calculateCartTotal() {
  const currentCart = getCurrentCart();
  let total = 0;
  let count = 0;
  Object.entries(currentCart).forEach(([id, qty]) => {
    const p = state.products.find(prod => prod.id === id);
    if (p) {
      total += p.price * qty;
      count += qty;
    }
  });
  return { total, count };
}

