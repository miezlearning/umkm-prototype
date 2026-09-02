/**
 * Kasir Mami - Central State Management & Multi-Tenant Storage
 */

import { 
  getStorageKeys, 
  GLOBAL_STORAGE_KEYS,
  MASTER_DEV_KEY,
  DEFAULT_PRODUCTS, 
  DEFAULT_QRIS_PAYLOAD, 
  DEFAULT_STORE_PROFILE,
  DEFAULT_PRINTER_CONFIG
} from './config.js';
import { parseQRISMetadata } from './qris.js';

/**
 * Dapatkan daftar toko yang tersimpan / pernah dibuka di perangkat ini
 */
export function getSavedStoresList() {
  try {
    const raw = localStorage.getItem(GLOBAL_STORAGE_KEYS.SAVED_STORES);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (e) {}
  
  // Default jika masih kosong: daftarkan Kedai Usaha Mami
  return [
    {
      id: 'kedai_usaha_mami',
      name: 'Kedai Usaha Mami',
      ownerName: 'Mami',
      phone: '081345028895',
      lastOpened: new Date().toISOString()
    }
  ];
}

export function registerStoreOnDevice(storeInfo) {
  if (!storeInfo || !storeInfo.id) return;
  const list = getSavedStoresList().filter(s => s.id !== storeInfo.id);
  list.unshift({
    id: storeInfo.id,
    name: storeInfo.name || storeInfo.id,
    ownerName: storeInfo.ownerName || 'Pemilik Toko',
    phone: storeInfo.phone || '',
    lastOpened: new Date().toISOString()
  });
  try {
    localStorage.setItem(GLOBAL_STORAGE_KEYS.SAVED_STORES, JSON.stringify(list));
  } catch (e) {}
}

export function removeStoreFromDevice(storeId) {
  if (!storeId) return;
  const list = getSavedStoresList().filter(s => s.id !== storeId);
  try {
    localStorage.setItem(GLOBAL_STORAGE_KEYS.SAVED_STORES, JSON.stringify(list));
  } catch (e) {}
}

/**
 * Deteksi Store ID dari URL query string (?store=...) atau localStorage
 */
export function resolveActiveStoreId() {
  if (sessionStorage.getItem('is_logged_out_state') === '1') {
    return null;
  }

  try {
    const params = new URLSearchParams(window.location.search);
    const storeParam = params.get('store');
    if (storeParam && storeParam.trim()) {
      const sanitized = storeParam.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '_');
      
      // Auto-restore hanya jika perangkat ini sudah memiliki sesi auth terverifikasi
      const isDeviceAuth = localStorage.getItem('auth_store_session_' + sanitized) === '1';
      if (isDeviceAuth) {
        localStorage.setItem(GLOBAL_STORAGE_KEYS.ACTIVE_STORE_ID, sanitized);
        return sanitized;
      }
      return null;
    }
  } catch (e) {}

  const savedActive = localStorage.getItem(GLOBAL_STORAGE_KEYS.ACTIVE_STORE_ID);
  if (savedActive && localStorage.getItem('auth_store_session_' + savedActive) === '1') {
    return savedActive;
  }

  return null;
}

export const activeStoreId = resolveActiveStoreId();
export const currentStorageKeys = getStorageKeys(activeStoreId || 'kedai_usaha_mami');

export const state = {
  storeId: activeStoreId,
  isSessionActive: !!activeStoreId,
  storeProfile: { ...DEFAULT_STORE_PROFILE, id: activeStoreId || 'toko_baru' },
  auth: {
    pin: '1234',
    ownerName: 'Pemilik Toko',
    phone: '081345028895',
    requirePinForAdmin: false
  },
  userRole: localStorage.getItem(GLOBAL_STORAGE_KEYS.AUTH_ROLE) || 'owner', // 'owner' or 'cashier'
  isUnlockedOwner: true,
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
  qrisMode: 'dynamic', // 'dynamic' (nominal pas otomatis) or 'static' (nominal manual)
  printerConfig: { ...DEFAULT_PRINTER_CONFIG }
};

/**
 * Muat seluruh data dari LocalStorage ke State
 */
export function initState() {
  state.currentCategory = 'all';

  if (!state.storeId) {
    state.isSessionActive = false;
    state.storeProfile = { id: '', name: 'Aristotle POS', city: '', nmid: '', acquirer: 'Aristotle POS' };
    state.products = [];
    state.transactions = [];
    state.expenses = [];
    state.orderQueues = [{ id: 'q_1', name: 'Pesanan #1', cart: {} }];
    state.activeQueueId = 'q_1';
    state.printerConfig = { ...DEFAULT_PRINTER_CONFIG };
    updateUIStoreBranding();
    return;
  }

  state.isSessionActive = true;
  const keys = getStorageKeys(state.storeId);

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

  // 7. Muat Auth & PIN Toko
  const savedAuth = localStorage.getItem(keys.AUTH);
  if (savedAuth) {
    try {
      state.auth = { ...state.auth, ...JSON.parse(savedAuth) };
    } catch (e) {}
  }

  // 8. Muat Konfigurasi Printer & Struk
  const savedPrinter = localStorage.getItem(keys.PRINTER);
  if (savedPrinter) {
    try {
      state.printerConfig = { ...DEFAULT_PRINTER_CONFIG, ...JSON.parse(savedPrinter) };
    } catch (e) {
      state.printerConfig = { ...DEFAULT_PRINTER_CONFIG };
    }
  } else {
    state.printerConfig = { ...DEFAULT_PRINTER_CONFIG };
  }

  // Daftarkan toko aktif ini ke registry perangkat
  registerStoreOnDevice({
    id: state.storeId,
    name: state.storeProfile?.name || state.storeId,
    ownerName: state.auth?.ownerName || 'Pemilik Toko',
    phone: state.auth?.phone || ''
  });

  // Update UI Elements with Store Branding
  updateUIStoreBranding();
}

/**
 * Simpan konfigurasi printer & struk
 */
export function savePrinterConfig(newConfig) {
  if (newConfig) {
    state.printerConfig = { ...state.printerConfig, ...newConfig };
  }
  localStorage.setItem(currentStorageKeys.PRINTER, JSON.stringify(state.printerConfig));
}

/**
 * Simpan konfigurasi auth & PIN toko
 */
export function saveStoreAuth(authData) {
  if (authData) {
    state.auth = { ...state.auth, ...authData };
  }
  localStorage.setItem(currentStorageKeys.AUTH, JSON.stringify(state.auth));
}

/**
 * Validasi PIN Toko
 */
export function verifyStorePin(pinInput) {
  const cleanPin = String(pinInput || '').trim();
  const currentPin = String(state.auth?.pin || '1234').trim();
  return cleanPin === currentPin || cleanPin === MASTER_DEV_KEY;
}

/**
 * Atur Role Pengguna ('owner' atau 'cashier')
 */
export function setUserRole(role = 'owner') {
  state.userRole = role;
  localStorage.setItem(GLOBAL_STORAGE_KEYS.AUTH_ROLE, role);
}

/**
 * Perbarui teks nama toko & branding di seluruh layar (Header, struk, laporan)
 */
export function updateUIStoreBranding() {
  const storeName = state.storeId ? (state.storeProfile?.name || state.storeId) : 'Aristotle POS';
  const nmid = state.storeId ? (state.storeProfile?.nmid || '') : '';

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
    cloudStoreIdEl.innerText = state.storeId ? `${storeName} (${state.storeId})` : 'Belum Ada Toko Terhubung';
  }
}

export function saveStoreProfile(profile) {
  if (profile) {
    state.storeProfile = { ...state.storeProfile, ...profile };
  }
  localStorage.setItem(currentStorageKeys.PROFILE, JSON.stringify(state.storeProfile));
  registerStoreOnDevice({
    id: state.storeId,
    name: state.storeProfile?.name || state.storeId,
    ownerName: state.auth?.ownerName || 'Pemilik Toko',
    phone: state.auth?.phone || ''
  });
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

