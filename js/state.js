/**
 * Kasir Mami - Central State Management & Storage
 */

import { STORAGE_KEYS, DEFAULT_PRODUCTS, DEFAULT_QRIS_PAYLOAD } from './config.js';

export const state = {
  products: [],
  transactions: [],
  expenses: [],
  orderQueues: [
    { id: 'q_1', name: 'Pesanan #1', cart: {} }
  ],
  activeQueueId: 'q_1',
  currentCategory: 'all',
  currentPeriod: 'today', // 'today', 'month', 'all'
  qrisPayload: DEFAULT_QRIS_PAYLOAD
};

/**
 * Muat seluruh data dari LocalStorage ke State
 */
export function initState() {
  // 1. Muat Produk
  const savedProducts = localStorage.getItem(STORAGE_KEYS.PRODUCTS);
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

  // 2. Muat Transaksi
  const savedHistory = localStorage.getItem(STORAGE_KEYS.HISTORY);
  if (savedHistory) {
    try {
      state.transactions = JSON.parse(savedHistory);
    } catch (e) {
      state.transactions = [];
    }
  }

  // 3. Muat Pengeluaran
  const savedExpenses = localStorage.getItem(STORAGE_KEYS.EXPENSES);
  if (savedExpenses) {
    try {
      state.expenses = JSON.parse(savedExpenses);
    } catch (e) {
      state.expenses = [];
    }
  }

  // 4. Muat Antrian Pesanan
  const savedQueues = localStorage.getItem(STORAGE_KEYS.QUEUES);
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

  // 5. Muat QRIS Payload
  const savedQris = localStorage.getItem(STORAGE_KEYS.QRIS);
  if (savedQris && savedQris.trim()) {
    state.qrisPayload = savedQris.trim();
  } else {
    state.qrisPayload = DEFAULT_QRIS_PAYLOAD;
  }

  if (
    state.orderQueues.length === 1 &&
    Object.keys(state.orderQueues[0].cart).length === 0 &&
    state.orderQueues[0].name.startsWith('Pesanan #')
  ) {
    state.orderQueues[0].name = 'Pesanan #1';
  }
}

export function saveProducts() {
  localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(state.products));
}

export function saveHistory() {
  localStorage.setItem(STORAGE_KEYS.HISTORY, JSON.stringify(state.transactions));
}

export function saveExpenses() {
  localStorage.setItem(STORAGE_KEYS.EXPENSES, JSON.stringify(state.expenses));
}

export function saveQueues() {
  localStorage.setItem(STORAGE_KEYS.QUEUES, JSON.stringify(state.orderQueues));
}

export function saveQrisPayload(payload) {
  state.qrisPayload = (payload || DEFAULT_QRIS_PAYLOAD).trim();
  localStorage.setItem(STORAGE_KEYS.QRIS, state.qrisPayload);
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
