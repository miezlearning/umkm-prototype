/**
 * Kasir Mami - Real-time Cloud Synchronization with Firebase Firestore
 * Enables seamless multi-device usage (Tablet Kasir & HP Mami)
 */

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import { 
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  collection, 
  doc, 
  getDoc,
  setDoc, 
  deleteDoc, 
  getDocs, 
  onSnapshot, 
  writeBatch
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

import { DEFAULT_PRODUCTS, getStorageKeys } from './config.js';
import { state, currentStorageKeys, updateUIStoreBranding, getSavedStoresList } from './state.js';
import { showToast } from './utils.js';

// Firebase Configuration from user
export const firebaseConfig = {
  apiKey: "AIzaSyBkSoXy_F41bOdz4U9gldw0zQIaK1FHMNQ",
  authDomain: "kedai-mami.firebaseapp.com",
  projectId: "kedai-mami",
  storageBucket: "kedai-mami.firebasestorage.app",
  messagingSenderId: "827309609612",
  appId: "1:827309609612:web:0a37ebf2c49696d0ace1a9",
  measurementId: "G-QW6CMQMM6P"
};

// Store Identification getter
export function getStoreId() {
  return state.storeId || null;
}

export function unsubscribeAllListeners() {
  listenersUnsubscribe.forEach(unsub => {
    try { if (typeof unsub === 'function') unsub(); } catch (e) {}
  });
  listenersUnsubscribe = [];
}

// Internal Firebase & Firestore instance
let app = null;
let db = null;
let isInitialized = false;
let isSyncing = false;
let syncStatus = 'connecting'; // 'connecting', 'online', 'offline', 'error'
let listenersUnsubscribe = [];

// Callback for UI updates on remote changes
let onRemoteUpdateCallback = null;

export function setRemoteUpdateCallback(cb) {
  onRemoteUpdateCallback = cb;
}

/**
 * Update the UI Cloud Sync indicator
 */
export function updateSyncStatusUI(status, message) {
  syncStatus = status;
  const dotEl = document.getElementById('cloudStatusDot');
  const textEl = document.getElementById('cloudStatusText');
  const modalStatusEl = document.getElementById('cloudModalStatusText');

  const statusMap = {
    online: {
      dot: 'bg-emerald-500',
      pulse: true,
      text: 'Cloud Sinkron',
      color: 'text-emerald-700'
    },
    syncing: {
      dot: 'bg-emerald-600',
      pulse: true,
      text: 'Menyinkronkan...',
      color: 'text-emerald-800'
    },
    offline: {
      dot: 'bg-stone-400',
      pulse: false,
      text: 'Mode Offline',
      color: 'text-stone-600'
    },
    error: {
      dot: 'bg-rose-500',
      pulse: false,
      text: 'Koneksi Gangguan',
      color: 'text-rose-700'
    }
  };

  const current = statusMap[status] || statusMap.offline;

  if (dotEl) {
    dotEl.className = `w-2 h-2 rounded-full ${current.dot} ${current.pulse ? 'animate-pulse' : ''}`;
  }
  if (textEl) {
    textEl.innerText = current.text;
  }
  if (modalStatusEl) {
    modalStatusEl.innerText = message || current.text;
    modalStatusEl.className = `text-xs font-bold ${current.color}`;
  }
}

/**
 * Initialize Firebase & Firestore Realtime Listeners
 */
export async function initFirebaseSync() {
  if (isInitialized) return;

  try {
    updateSyncStatusUI('syncing', 'Menghubungkan ke Google Firebase...');

    // Initialize Firebase App
    app = initializeApp(firebaseConfig);
    
    try {
      db = initializeFirestore(app, {
        localCache: persistentLocalCache({
          tabManager: persistentMultipleTabManager()
        })
      });
    } catch (cacheErr) {
      db = getFirestore(app);
    }

    isInitialized = true;

    // Only subscribe to Firestore if a store is actively selected
    if (state.storeId) {
      updateSyncStatusUI('online', 'Online & Terhubung');
      setupRealtimeListeners();
    } else {
      updateSyncStatusUI('offline', 'Belum Masuk Toko');
    }

    // Listen for online/offline browser events
    window.addEventListener('online', () => {
      if (state.storeId) {
        updateSyncStatusUI('online', 'Online & Terhubung');
      } else {
        updateSyncStatusUI('offline', 'Belum Masuk Toko');
      }
    });

    window.addEventListener('offline', () => {
      updateSyncStatusUI('offline', 'Mode Offline (Lokal)');
    });

  } catch (error) {
    console.error('Failed to initialize Firebase:', error);
    updateSyncStatusUI('offline', 'Mode Offline (Lokal)');
  }
}

/**
 * Setup Realtime Listeners for Products, Transactions, Expenses, Queues, and Store Profile
 */
export function setupRealtimeListeners() {
  if (!db) return;

  const currentStoreId = getStoreId();

  // Clear existing listeners if any
  unsubscribeAllListeners();

  if (!currentStoreId) {
    updateSyncStatusUI('offline', 'Belum Masuk Toko');
    return;
  }

  updateSyncStatusUI('online', 'Online & Terhubung');

  // 1. PRODUCTS LISTENER
  const productsCol = collection(db, 'stores', currentStoreId, 'products');
  const unsubProducts = onSnapshot(productsCol, (snapshot) => {
    if (snapshot.empty) {
      // First time initialization in cloud: seed default or local products
      seedInitialProducts();
    } else {
      const cloudProducts = [];
      snapshot.forEach(docSnap => {
        const data = docSnap.data();
        cloudProducts.push({ 
          id: docSnap.id, 
          name: data.name || 'Menu',
          price: Number(data.price) || 0,
          category: data.category || 'makanan',
          icon: data.icon || 'lunch_dining',
          isAvailable: data.isAvailable !== false,
          trackStock: !!data.trackStock,
          stock: data.trackStock ? (data.stock !== undefined && data.stock !== null ? Number(data.stock) : null) : null,
          updatedAt: data.updatedAt || new Date().toISOString()
        });
      });

      // Update state and localStorage
      state.products = cloudProducts;
      localStorage.setItem(currentStorageKeys.PRODUCTS, JSON.stringify(cloudProducts));

      if (onRemoteUpdateCallback) onRemoteUpdateCallback('products');
    }
  }, (error) => {
    console.error('Products onSnapshot error:', error);
  });
  listenersUnsubscribe.push(unsubProducts);

  // 2. TRANSACTIONS LISTENER
  const txCol = collection(db, 'stores', currentStoreId, 'transactions');
  const unsubTx = onSnapshot(txCol, (snapshot) => {
    const cloudTransactions = [];
    snapshot.forEach(docSnap => {
      cloudTransactions.push({ id: docSnap.id, ...docSnap.data() });
    });

    // Sort newest first
    cloudTransactions.sort((a, b) => new Date(b.date) - new Date(a.date));

    // Update state and localStorage
    state.transactions = cloudTransactions;
    localStorage.setItem(currentStorageKeys.HISTORY, JSON.stringify(cloudTransactions));

    if (onRemoteUpdateCallback) onRemoteUpdateCallback('transactions');
  }, (error) => {
    console.error('Transactions onSnapshot error:', error);
  });
  listenersUnsubscribe.push(unsubTx);

  // 3. EXPENSES LISTENER
  const expCol = collection(db, 'stores', currentStoreId, 'expenses');
  const unsubExp = onSnapshot(expCol, (snapshot) => {
    const cloudExpenses = [];
    snapshot.forEach(docSnap => {
      cloudExpenses.push({ id: docSnap.id, ...docSnap.data() });
    });

    // Sort newest first
    cloudExpenses.sort((a, b) => new Date(b.date) - new Date(a.date));

    // Update state and localStorage
    state.expenses = cloudExpenses;
    localStorage.setItem(currentStorageKeys.EXPENSES, JSON.stringify(cloudExpenses));

    if (onRemoteUpdateCallback) onRemoteUpdateCallback('expenses');
  }, (error) => {
    console.error('Expenses onSnapshot error:', error);
  });
  listenersUnsubscribe.push(unsubExp);

  // 4. ORDER QUEUES LISTENER (Shared Antrian / Meja)
  const queuesDocRef = doc(db, 'stores', currentStoreId, 'data', 'queues');
  const unsubQueues = onSnapshot(queuesDocRef, (docSnap) => {
    if (docSnap.exists()) {
      const data = docSnap.data();
      if (data && Array.isArray(data.list) && data.list.length > 0) {
        state.orderQueues = data.list;
        if (!state.orderQueues.some(q => q.id === state.activeQueueId)) {
          state.activeQueueId = state.orderQueues[0].id;
        }
        localStorage.setItem(currentStorageKeys.QUEUES, JSON.stringify(state.orderQueues));
        if (onRemoteUpdateCallback) onRemoteUpdateCallback('queues');
      }
    }
  }, (error) => {
    console.error('Queues onSnapshot error:', error);
  });
  listenersUnsubscribe.push(unsubQueues);

  // 5. CONFIG (QRIS Payload) LISTENER
  const configDocRef = doc(db, 'stores', currentStoreId, 'data', 'config');
  const unsubConfig = onSnapshot(configDocRef, (docSnap) => {
    if (docSnap.exists()) {
      const data = docSnap.data();
      if (data && data.qrisPayload) {
        state.qrisPayload = data.qrisPayload;
        localStorage.setItem(currentStorageKeys.QRIS, data.qrisPayload);
        if (onRemoteUpdateCallback) onRemoteUpdateCallback('config');
      }
      if (data && data.profile) {
        state.storeProfile = { ...state.storeProfile, ...data.profile };
        localStorage.setItem(currentStorageKeys.PROFILE, JSON.stringify(state.storeProfile));
        updateUIStoreBranding();
      }
      if (data && data.auth) {
        state.auth = { ...state.auth, ...data.auth };
        localStorage.setItem(currentStorageKeys.AUTH, JSON.stringify(state.auth));
      }
    }
  }, (error) => {
    console.error('Config onSnapshot error:', error);
  });
  listenersUnsubscribe.push(unsubConfig);
}

export async function syncSaveQrisPayload(qrisPayload) {
  if (!db) return;
  try {
    const currentStoreId = getStoreId();
    const docRef = doc(db, 'stores', currentStoreId, 'data', 'config');
    await setDoc(docRef, {
      qrisPayload,
      profile: state.storeProfile || null,
      auth: state.auth || null,
      updatedAt: new Date().toISOString()
    }, { merge: true });
  } catch (e) {
    console.error('Failed to sync QRIS payload to cloud:', e);
  }
}

export async function syncSaveStoreProfile(profile) {
  if (!db) return;
  try {
    const currentStoreId = getStoreId();
    const docRef = doc(db, 'stores', currentStoreId, 'data', 'config');
    await setDoc(docRef, {
      profile,
      updatedAt: new Date().toISOString()
    }, { merge: true });
  } catch (e) {
    console.error('Failed to sync store profile to cloud:', e);
  }
}

export async function syncSaveStoreAuth(authData) {
  if (!db) return;
  try {
    const currentStoreId = getStoreId();
    const docRef = doc(db, 'stores', currentStoreId, 'data', 'config');
    await setDoc(docRef, {
      auth: authData,
      updatedAt: new Date().toISOString()
    }, { merge: true });
  } catch (e) {
    console.error('Failed to sync store auth to cloud:', e);
  }
}

/**
 * Middleware Autentikasi & Verifikasi PIN Toko (Cloud & Local Multi-Tenant Auth)
 * Menolak toko yang belum terdaftar dan menolak PIN yang salah.
 */
export async function authenticateStoreLogin(storeId, inputPin) {
  const cleanId = (storeId || '').trim().toLowerCase().replace(/[^a-z0-9_-]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
  if (!cleanId) {
    return { success: false, exists: false, message: 'Harap masukkan nama / ID toko dengan benar' };
  }

  const trimmedPin = String(inputPin || '').trim();
  if (!trimmedPin || trimmedPin.length !== 4) {
    return { success: false, exists: true, message: 'Harap masukkan 4 digit PIN toko' };
  }

  // 1. Cek dari Local Storage
  const localKeys = getStorageKeys(cleanId);
  let localAuth = null;
  let localProfile = null;
  try {
    const authStr = localStorage.getItem(localKeys.AUTH);
    if (authStr) localAuth = JSON.parse(authStr);
    const profStr = localStorage.getItem(localKeys.PROFILE);
    if (profStr) localProfile = JSON.parse(profStr);
  } catch (e) {}

  // 2. Cek dari Cloud Firestore
  let cloudAuth = null;
  let cloudProfile = null;
  let storeDocExists = false;

  if (db) {
    try {
      const configRef = doc(db, 'stores', cleanId, 'data', 'config');
      const snap = await getDoc(configRef);
      if (snap.exists()) {
        storeDocExists = true;
        const data = snap.data();
        if (data) {
          cloudAuth = data.auth || null;
          cloudProfile = data.profile || null;
        }
      }
    } catch (e) {
      console.warn('Firestore lookup error:', e);
    }
  }

  const activeAuth = cloudAuth || localAuth;
  const activeProfile = cloudProfile || localProfile;
  const storeName = activeProfile?.name || cleanId.replace(/_/g, ' ').toUpperCase();

  // Jika toko tidak ada di local storage dan tidak ada di Firestore
  if (!activeAuth && !storeDocExists) {
    const savedStores = getSavedStoresList();
    const isSaved = savedStores.some(s => s.id === cleanId);
    if (!isSaved) {
      return {
        success: false,
        exists: false,
        storeName,
        message: `Toko "${storeName}" belum terdaftar di sistem. Silakan mendaftar di tab "+ Daftar Toko Baru".`
      };
    }
  }

  // Cek apakah PIN cocok
  const expectedPin = String(activeAuth?.pin || '1234').trim();

  if (trimmedPin !== expectedPin) {
    return {
      success: false,
      exists: true,
      storeName,
      message: `PIN salah untuk toko "${storeName}". Masukkan 4 digit PIN yang sesuai.`
    };
  }

  // Jika lolos autentikasi -> Cache profile & auth ke local storage
  try {
    if (cloudAuth) localStorage.setItem(localKeys.AUTH, JSON.stringify(cloudAuth));
    if (cloudProfile) localStorage.setItem(localKeys.PROFILE, JSON.stringify(cloudProfile));
  } catch (err) {}

  return {
    success: true,
    exists: true,
    storeName,
    cleanId,
    profile: activeProfile || { id: cleanId, name: storeName }
  };
}

export async function verifyStorePin(storeId, inputPin) {
  const res = await authenticateStoreLogin(storeId, inputPin);
  return res.success;
}

/**
 * Ambil konfigurasi (Profile & Auth) toko dari Cloud
 */
export async function fetchStoreConfigFromCloud(storeId) {
  const cleanId = (storeId || '').trim().toLowerCase().replace(/[^a-z0-9_-]/g, '_');
  if (!cleanId || !db) return null;
  try {
    const docRef = doc(db, 'stores', cleanId, 'data', 'config');
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      return snap.data();
    }
  } catch (e) {}
  return null;
}

/**
 * Seed initial products to cloud if Firestore collection is empty
 */
async function seedInitialProducts() {
  if (!db) return;
  try {
    const currentStoreId = getStoreId();
    const localProds = state.products && state.products.length > 0 ? state.products : DEFAULT_PRODUCTS;
    const batch = writeBatch(db);
    localProds.forEach(p => {
      const docRef = doc(db, 'stores', currentStoreId, 'products', p.id);
      batch.set(docRef, {
        name: p.name,
        price: p.price,
        category: p.category,
        icon: p.icon || 'lunch_dining',
        isAvailable: p.isAvailable !== false,
        trackStock: !!p.trackStock,
        stock: p.trackStock ? (p.stock !== undefined && p.stock !== null ? Number(p.stock) : null) : null,
        updatedAt: new Date().toISOString()
      }, { merge: true });
    });
    await batch.commit();
  } catch (e) {
    console.error('Error seeding initial products:', e);
  }
}

// ================= CLOUD MUTATION HELPERS =================

/**
 * Save or update single product in cloud
 */
export async function syncSaveProduct(product) {
  if (!db) return;
  try {
    const currentStoreId = getStoreId();
    const docRef = doc(db, 'stores', currentStoreId, 'products', product.id);
    await setDoc(docRef, {
      name: product.name,
      price: product.price,
      category: product.category,
      icon: product.icon || 'lunch_dining',
      isAvailable: product.isAvailable !== false,
      trackStock: !!product.trackStock,
      stock: product.trackStock ? (product.stock !== undefined && product.stock !== null ? Number(product.stock) : null) : null,
      updatedAt: new Date().toISOString()
    }, { merge: true });
  } catch (e) {
    console.error('Failed to sync product to cloud:', e);
  }
}

/**
 * Delete product in cloud
 */
export async function syncDeleteProduct(productId) {
  if (!db) return;
  try {
    const currentStoreId = getStoreId();
    const docRef = doc(db, 'stores', currentStoreId, 'products', productId);
    await deleteDoc(docRef);
  } catch (e) {
    console.error('Failed to delete product in cloud:', e);
  }
}

/**
 * Add new completed transaction to cloud
 */
export async function syncAddTransaction(transaction) {
  if (!db) return;
  try {
    const currentStoreId = getStoreId();
    const docRef = doc(db, 'stores', currentStoreId, 'transactions', transaction.id);
    await setDoc(docRef, {
      ...transaction,
      syncedAt: new Date().toISOString()
    });
  } catch (e) {
    console.error('Failed to sync transaction to cloud:', e);
  }
}

/**
 * Delete single transaction in cloud
 */
export async function syncDeleteTransaction(transactionId) {
  if (!db) return;
  try {
    const currentStoreId = getStoreId();
    const docRef = doc(db, 'stores', currentStoreId, 'transactions', transactionId);
    await deleteDoc(docRef);
  } catch (e) {
    console.error('Failed to delete transaction in cloud:', e);
  }
}

/**
 * Clear all transaction history in cloud
 */
export async function syncClearAllHistory() {
  if (!db) return;
  try {
    const currentStoreId = getStoreId();
    const txCol = collection(db, 'stores', currentStoreId, 'transactions');
    const snap = await getDocs(txCol);
    const batch = writeBatch(db);
    snap.forEach(d => batch.delete(d.ref));
    await batch.commit();
  } catch (e) {
    console.error('Failed to clear history in cloud:', e);
  }
}

/**
 * Clear today transactions and expenses in cloud
 */
export async function syncClearTodayData() {
  if (!db) return;
  try {
    const currentStoreId = getStoreId();
    const nowStr = new Date().toDateString();
    const batch = writeBatch(db);

    // Filter tx
    const txCol = collection(db, 'stores', currentStoreId, 'transactions');
    const txSnap = await getDocs(txCol);
    txSnap.forEach(d => {
      const data = d.data();
      if (data.date && new Date(data.date).toDateString() === nowStr) {
        batch.delete(d.ref);
      }
    });

    // Filter exp
    const expCol = collection(db, 'stores', currentStoreId, 'expenses');
    const expSnap = await getDocs(expCol);
    expSnap.forEach(d => {
      const data = d.data();
      if (data.date && new Date(data.date).toDateString() === nowStr) {
        batch.delete(d.ref);
      }
    });

    await batch.commit();
  } catch (e) {
    console.error('Failed to clear today data in cloud:', e);
  }
}

/**
 * Add new expense record in cloud
 */
export async function syncAddExpense(expense) {
  if (!db) return;
  try {
    const currentStoreId = getStoreId();
    const docRef = doc(db, 'stores', currentStoreId, 'expenses', expense.id);
    await setDoc(docRef, {
      ...expense,
      syncedAt: new Date().toISOString()
    });
  } catch (e) {
    console.error('Failed to sync expense to cloud:', e);
  }
}

/**
 * Delete expense record in cloud
 */
export async function syncDeleteExpense(expenseId) {
  if (!db) return;
  try {
    const currentStoreId = getStoreId();
    const docRef = doc(db, 'stores', currentStoreId, 'expenses', expenseId);
    await deleteDoc(docRef);
  } catch (e) {
    console.error('Failed to delete expense in cloud:', e);
  }
}

/**
 * Sync Order Queues (Keranjang Antrian Aktif) to Cloud
 */
export async function syncSaveQueues(queues) {
  if (!db) return;
  try {
    const currentStoreId = getStoreId();
    const docRef = doc(db, 'stores', currentStoreId, 'data', 'queues');
    await setDoc(docRef, {
      list: queues,
      updatedAt: new Date().toISOString()
    });
  } catch (e) {
    console.error('Failed to sync queues to cloud:', e);
  }
}

/**
 * Force Push Local Data to Cloud (Manual Full Sync)
 */
export async function forceUploadAllToCloud() {
  if (!db) {
    showToast('Firebase belum terhubung. Periksa koneksi internet Anda.', 'warning');
    return;
  }

  const currentStoreId = getStoreId();
  updateSyncStatusUI('syncing', 'Mengunggah semua data lokal ke Cloud...');
  try {
    const batch = writeBatch(db);

    // 1. Upload Products
    state.products.forEach(p => {
      const docRef = doc(db, 'stores', currentStoreId, 'products', p.id);
      batch.set(docRef, {
        name: p.name,
        price: p.price,
        category: p.category,
        icon: p.icon || 'lunch_dining',
        isAvailable: p.isAvailable !== false,
        trackStock: !!p.trackStock,
        stock: p.trackStock ? (p.stock !== undefined && p.stock !== null ? Number(p.stock) : null) : null,
        updatedAt: new Date().toISOString()
      }, { merge: true });
    });

    // 2. Upload Transactions
    state.transactions.forEach(t => {
      const docRef = doc(db, 'stores', currentStoreId, 'transactions', t.id);
      batch.set(docRef, { ...t, syncedAt: new Date().toISOString() }, { merge: true });
    });

    // 3. Upload Expenses
    state.expenses.forEach(e => {
      const docRef = doc(db, 'stores', currentStoreId, 'expenses', e.id);
      batch.set(docRef, { ...e, syncedAt: new Date().toISOString() }, { merge: true });
    });

    // 4. Upload Queues
    const queuesRef = doc(db, 'stores', currentStoreId, 'data', 'queues');
    batch.set(queuesRef, {
      list: state.orderQueues,
      updatedAt: new Date().toISOString()
    });

    // 5. Upload Config (QRIS Payload & Store Profile)
    const configRef = doc(db, 'stores', currentStoreId, 'data', 'config');
    batch.set(configRef, {
      qrisPayload: state.qrisPayload,
      profile: state.storeProfile || null,
      updatedAt: new Date().toISOString()
    }, { merge: true });

    await batch.commit();
    updateSyncStatusUI('online', 'Semua data lokal berhasil diunggah ke Cloud');
    showToast(`Data toko [${state.storeProfile.name}] berhasil disinkronkan ke Cloud!`, 'success');
  } catch (e) {
    console.error('Force upload error:', e);
    updateSyncStatusUI('error', 'Gagal mengunggah data ke cloud');
    showToast('Gagal menyinkronkan data: ' + e.message, 'error');
  }
}
