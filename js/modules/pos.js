/**
 * Kasir Mami - POS Module (Catalog, Order Queue, Cart)
 */

import { state, saveQueues, getCurrentCart, getActiveQueue, calculateCartTotal } from '../state.js';
import { formatRp, playBeep, escapeHtml } from '../utils.js';

// ================= MULTI-ORDER QUEUE =================
export function renderOrderQueueTabs() {
  const container = document.getElementById('orderQueueTabs');
  if (!container) return;

  container.innerHTML = state.orderQueues.map((q) => {
    const isActive = q.id === state.activeQueueId;
    const itemCount = Object.values(q.cart).reduce((a, b) => a + b, 0);
    return `
      <div class="flex items-center gap-1 rounded-xl px-2.5 py-1 ${isActive ? 'bg-m3-primary text-white shadow-sm' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'} transition shrink-0">
        <button onclick="window.KasirApp.switchOrderQueue('${q.id}')" class="font-extrabold text-xs flex items-center gap-1.5 touch-target-large">
          <span>${escapeHtml(q.name)}</span>
          ${itemCount > 0 ? `<span class="px-1.5 py-0.2 rounded-full text-[9px] ${isActive ? 'bg-amber-400 text-slate-900 font-black' : 'bg-teal-600 text-white'}">${itemCount}</span>` : ''}
        </button>
        <button onclick="window.KasirApp.deleteOrderQueue('${q.id}', event)" class="p-0.5 hover:bg-black/20 rounded-md text-xs flex items-center justify-center" title="Hapus / Tutup Antrian">
          <span class="material-symbols-rounded text-sm">close</span>
        </button>
      </div>
    `;
  }).join('');

  const cur = getActiveQueue();
  if (cur) {
    const titleEl = document.getElementById('currentOrderTitle');
    const drawerTitleEl = document.getElementById('mobileDrawerTitle');
    if (titleEl) titleEl.innerText = cur.name;
    if (drawerTitleEl) drawerTitleEl.innerText = cur.name;
  }
}

export function addNewOrderQueue() {
  let nextNum = 1;
  const existingNums = state.orderQueues.map(q => {
    const m = q.name.match(/Pesanan\s*#(\d+)/i);
    return m ? parseInt(m[1], 10) : 0;
  });
  while (existingNums.includes(nextNum)) {
    nextNum++;
  }

  const newId = 'q_' + Date.now();
  state.orderQueues.push({
    id: newId,
    name: `Pesanan #${nextNum}`,
    cart: {}
  });
  state.activeQueueId = newId;
  saveQueues();
  renderOrderQueueTabs();
  renderCart();
  renderProducts();
}

export function switchOrderQueue(queueId) {
  state.activeQueueId = queueId;
  renderOrderQueueTabs();
  renderCart();
  renderProducts();
}

export function promptRenameQueue() {
  const cur = getActiveQueue();
  if (!cur) return;
  const newName = prompt('Ubah nama antrian / meja ini:', cur.name);
  if (newName && newName.trim()) {
    cur.name = newName.trim();
    saveQueues();
    renderOrderQueueTabs();
  }
}

export function deleteOrderQueue(queueId, event) {
  if (event) event.stopPropagation();
  const qToDelete = state.orderQueues.find(q => q.id === queueId);
  if (!qToDelete) return;
  
  const itemCount = Object.values(qToDelete.cart).reduce((a, b) => a + b, 0);
  if (itemCount > 0) {
    if (!confirm(`Hapus ${qToDelete.name} yang berisi ${itemCount} pesanan?`)) return;
  }

  state.orderQueues = state.orderQueues.filter(q => q.id !== queueId);

  if (state.orderQueues.length === 0) {
    state.orderQueues = [{ id: 'q_' + Date.now(), name: 'Pesanan #1', cart: {} }];
  } else if (
    state.orderQueues.length === 1 &&
    Object.keys(state.orderQueues[0].cart).length === 0 &&
    state.orderQueues[0].name.startsWith('Pesanan #')
  ) {
    state.orderQueues[0].name = 'Pesanan #1';
  }

  if (!state.orderQueues.some(q => q.id === state.activeQueueId)) {
    state.activeQueueId = state.orderQueues[0].id;
  }

  saveQueues();
  renderOrderQueueTabs();
  renderCart();
  renderProducts();
}

// ================= CATEGORY & PRODUCT RENDERING =================
export function setCategory(cat) {
  state.currentCategory = cat;
  document.querySelectorAll('.cat-pill').forEach(btn => {
    btn.className = 'cat-pill py-2 px-1 sm:px-4 rounded-xl font-extrabold text-xs sm:text-sm text-center bg-slate-100 hover:bg-slate-200 text-slate-700 transition flex flex-col sm:flex-row items-center justify-center gap-0.5 sm:gap-1.5 touch-target-large';
  });
  const activeBtn = document.getElementById(`cat-${cat}`);
  if (activeBtn) {
    activeBtn.className = 'cat-pill py-2 px-1 sm:px-4 rounded-xl font-extrabold text-xs sm:text-sm text-center bg-m3-primary text-white shadow transition flex flex-col sm:flex-row items-center justify-center gap-0.5 sm:gap-1.5 touch-target-large';
  }
  renderProducts();
}

export function renderProducts() {
  const grid = document.getElementById('productGrid');
  if (!grid) return;

  const searchInput = document.getElementById('searchInput');
  const search = (searchInput ? searchInput.value : '').toLowerCase().trim();
  const currentCart = getCurrentCart();

  const filtered = state.products.filter(p => {
    const matchesCat = (state.currentCategory === 'all') || (p.category === state.currentCategory);
    const matchesSearch = p.name.toLowerCase().includes(search);
    return matchesCat && matchesSearch;
  });

  if (filtered.length === 0) {
    grid.innerHTML = `
      <div class="col-span-full py-10 text-center text-slate-400 flex flex-col items-center justify-center gap-1.5">
        <span class="material-symbols-rounded text-4xl">search_off</span>
        <p class="font-bold text-sm">Menu tidak ditemukan</p>
      </div>
    `;
    return;
  }

  grid.innerHTML = filtered.map(product => {
    const qty = currentCart[product.id] || 0;
    const hasQty = qty > 0;
    return `
      <div onclick="window.KasirApp.addToCart('${product.id}')" class="relative bg-white active:scale-[0.97] border-2 ${hasQty ? 'border-m3-primary bg-teal-50/40 shadow-md' : 'border-slate-200 shadow-sm'} rounded-2xl p-2.5 sm:p-4 flex flex-col justify-between cursor-pointer transition touch-target-large">
        
        ${hasQty ? `
          <span class="absolute -top-1.5 -right-1.5 bg-m3-primary text-white font-black text-xs px-2 py-0.5 rounded-full shadow-md">
            ${qty}x
          </span>
        ` : ''}

        <div class="flex items-start justify-between gap-1">
          <div class="w-9 h-9 sm:w-12 sm:h-12 rounded-xl ${hasQty ? 'bg-m3-primary text-white' : 'bg-m3-surfaceVariant text-m3-onSurfaceVariant'} flex items-center justify-center shrink-0">
            <span class="material-symbols-rounded text-xl sm:text-2xl">${product.icon || 'lunch_dining'}</span>
          </div>
          <span class="text-[9px] font-bold text-slate-400 capitalize px-1.5 py-0.5 rounded bg-slate-100">${escapeHtml(product.category)}</span>
        </div>

        <div class="mt-2">
          <h3 class="font-extrabold text-slate-800 text-xs sm:text-base leading-tight line-clamp-2">${escapeHtml(product.name)}</h3>
          <p class="font-black text-m3-primary text-sm sm:text-lg mt-0.5">${formatRp(product.price)}</p>
        </div>

        <div class="mt-1.5 pt-1 border-t border-slate-100 flex items-center justify-between text-[11px] font-bold ${hasQty ? 'text-m3-primary' : 'text-slate-400'}">
          <span>+ Tambah</span>
          <span class="material-symbols-rounded text-base">add_circle</span>
        </div>
      </div>
    `;
  }).join('');
}

// ================= CART OPERATIONS =================
export function addToCart(productId) {
  playBeep(700, 0.05);
  const q = getActiveQueue();
  if (q) {
    q.cart[productId] = (q.cart[productId] || 0) + 1;
    saveQueues();
    renderOrderQueueTabs();
    renderCart();
    renderProducts();
  }
}

export function updateCartQty(productId, delta) {
  playBeep(500, 0.05);
  const q = getActiveQueue();
  if (!q || !q.cart[productId]) return;
  q.cart[productId] += delta;
  if (q.cart[productId] <= 0) delete q.cart[productId];
  saveQueues();
  renderOrderQueueTabs();
  renderCart();
  renderProducts();
}

export function confirmClearCart() {
  const q = getActiveQueue();
  if (!q || Object.keys(q.cart).length === 0) return;
  if (confirm(`Kosongkan semua pesanan di ${q.name}?`)) {
    q.cart = {};
    saveQueues();
    toggleMobileCartDrawer(false);
    renderOrderQueueTabs();
    renderCart();
    renderProducts();
  }
}

export function renderCart() {
  const { total, count } = calculateCartTotal();
  const hasItems = count > 0;
  const currentCart = getCurrentCart();

  const desktopList = document.getElementById('cartItemsList');
  const desktopTotal = document.getElementById('cartTotalDisplay');
  const desktopCount = document.getElementById('cartCountBadge');
  const desktopBtnCheckout = document.getElementById('btnCheckout');
  
  if (desktopTotal) desktopTotal.innerText = formatRp(total);
  if (desktopCount) desktopCount.innerText = `${count} item`;
  if (desktopBtnCheckout) desktopBtnCheckout.disabled = !hasItems;

  const mobileFloating = document.getElementById('mobileFloatingCart');
  const mobilePillCount = document.getElementById('mobilePillCount');
  const mobilePillTotal = document.getElementById('mobilePillTotal');
  const mobileHeaderTotal = document.getElementById('mobileHeaderCartTotal');

  if (mobileHeaderTotal) {
    mobileHeaderTotal.innerText = hasItems ? formatRp(total) : 'Rp 0';
  }

  if (mobileFloating) {
    if (hasItems) {
      const cur = getActiveQueue();
      mobilePillCount.innerText = `${cur ? cur.name : 'Pesanan'} (${count} Item)`;
      mobilePillTotal.innerText = formatRp(total);
      mobileFloating.classList.remove('translate-y-28', 'opacity-0', 'pointer-events-none');
    } else {
      mobileFloating.classList.add('translate-y-28', 'opacity-0', 'pointer-events-none');
    }
  }

  const itemIds = Object.keys(currentCart);
  const itemsHtml = itemIds.length === 0 ? `
    <div class="flex flex-col items-center justify-center h-32 text-slate-400 gap-1">
      <span class="material-symbols-rounded text-3xl text-slate-300">touch_app</span>
      <p class="font-bold text-xs sm:text-sm text-center">Sentuh menu untuk menambah pesanan</p>
    </div>
  ` : itemIds.map(id => {
    const p = state.products.find(prod => prod.id === id);
    if (!p) return '';
    const qty = currentCart[id];
    const subtotal = p.price * qty;

    return `
      <div class="py-2 flex items-center justify-between gap-1.5">
        <div class="flex-1 min-w-0">
          <h4 class="font-extrabold text-slate-800 text-xs sm:text-sm truncate">${escapeHtml(p.name)}</h4>
          <p class="text-[11px] font-bold text-slate-500">${formatRp(p.price)} &times; ${qty} = <span class="text-m3-primary font-black">${formatRp(subtotal)}</span></p>
        </div>
        <div class="flex items-center gap-1 shrink-0">
          <button onclick="window.KasirApp.updateCartQty('${id}', -1)" class="w-7 h-7 rounded-lg bg-slate-100 text-slate-800 font-black text-sm flex items-center justify-center touch-target-large">-</button>
          <span class="w-5 text-center font-black text-xs text-slate-800">${qty}</span>
          <button onclick="window.KasirApp.updateCartQty('${id}', 1)" class="w-7 h-7 rounded-lg bg-m3-primary text-white font-black text-sm flex items-center justify-center touch-target-large">+</button>
        </div>
      </div>
    `;
  }).join('');

  if (desktopList) desktopList.innerHTML = itemsHtml;
  
  const drawerList = document.getElementById('mobileDrawerCartItems');
  const drawerTotal = document.getElementById('mobileDrawerTotalDisplay');
  if (drawerList) drawerList.innerHTML = itemsHtml;
  if (drawerTotal) drawerTotal.innerText = formatRp(total);
}

export function toggleMobileCartDrawer(forcedState) {
  const drawer = document.getElementById('mobileCartDrawer');
  if (!drawer) return;
  if (typeof forcedState === 'boolean') {
    drawer.classList.toggle('hidden', !forcedState);
  } else {
    drawer.classList.toggle('hidden');
  }
}
