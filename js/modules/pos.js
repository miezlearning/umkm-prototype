/**
 * Kasir Mami - POS Module (Catalog, Order Queue, Cart)
 */

import { state, saveQueues, getCurrentCart, getActiveQueue, calculateCartTotal } from '../state.js';
import { formatRp, playBeep, escapeHtml } from '../utils.js';
import { syncSaveQueues } from '../firebase.js';

// ================= MULTI-ORDER QUEUE =================
export function renderOrderQueueTabs() {
  const container = document.getElementById('orderQueueTabs');
  if (!container) return;

  container.innerHTML = state.orderQueues.map((q) => {
    const isActive = q.id === state.activeQueueId;
    const itemCount = Object.values(q.cart).reduce((a, b) => a + b, 0);

    let tabStyle = '';
    let badgeStyle = '';

    if (isActive) {
      tabStyle = 'bg-stone-900 text-white font-black shadow-md ring-2 ring-emerald-500/60 active-queue-tab scale-[1.02]';
      badgeStyle = 'bg-emerald-500 text-stone-950 font-black';
    } else if (itemCount > 0) {
      tabStyle = 'bg-emerald-50 text-emerald-950 hover:bg-emerald-100 font-extrabold border border-emerald-300/80 shadow-sm';
      badgeStyle = 'bg-emerald-600 text-white font-black';
    } else {
      tabStyle = 'bg-stone-100/90 text-stone-600 hover:bg-stone-200 font-bold border border-stone-200';
      badgeStyle = 'bg-stone-200 text-stone-700 font-bold';
    }

    return `
      <button onclick="window.KasirApp.switchOrderQueue('${q.id}')"
        class="active-queue-tab-wrapper px-3.5 py-2 rounded-xl text-xs sm:text-sm flex items-center gap-2 transition shrink-0 touch-target-large ${tabStyle}">
        <span>${escapeHtml(q.name)}</span>
        ${itemCount > 0 ? `<span class="px-2 py-0.5 rounded-full text-[10px] sm:text-xs ${badgeStyle}">${itemCount}</span>` : ''}
      </button>
    `;
  }).join('');

  const cur = getActiveQueue();
  if (cur) {
    const titleEl = document.getElementById('currentOrderTitle');
    const drawerTitleEl = document.getElementById('mobileDrawerTitle');
    if (titleEl) titleEl.innerText = cur.name;
    if (drawerTitleEl) drawerTitleEl.innerText = cur.name;
  }

  // Auto-scroll active tab into view smoothly & init drag scroll
  setTimeout(() => {
    initQueueDragScroll();
    const activeTab = container.querySelector('.active-queue-tab');
    if (activeTab) {
      activeTab.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
    }
  }, 40);
}

export function initQueueDragScroll() {
  const slider = document.getElementById('orderQueueTabs');
  if (!slider || slider.dataset.dragInit) return;
  slider.dataset.dragInit = 'true';

  let isDown = false;
  let startX;
  let scrollLeft;

  slider.addEventListener('mousedown', (e) => {
    isDown = true;
    startX = e.pageX - slider.offsetLeft;
    scrollLeft = slider.scrollLeft;
  });

  slider.addEventListener('mouseleave', () => {
    isDown = false;
  });

  slider.addEventListener('mouseup', () => {
    isDown = false;
  });

  slider.addEventListener('mousemove', (e) => {
    if (!isDown) return;
    e.preventDefault();
    const x = e.pageX - slider.offsetLeft;
    const walk = (x - startX) * 1.5;
    slider.scrollLeft = scrollLeft - walk;
  });
}

export function scrollQueueTabs(direction) {
  const container = document.getElementById('orderQueueTabs');
  if (!container) return;
  const scrollAmount = direction === 'left' ? -200 : 200;
  container.scrollBy({ left: scrollAmount, behavior: 'smooth' });
}

export function handleQueueWheel(e) {
  const container = document.getElementById('orderQueueTabs');
  if (!container) return;
  if (e.deltaY !== 0) {
    e.preventDefault();
    container.scrollLeft += e.deltaY;
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
  syncSaveQueues(state.orderQueues);
  renderOrderQueueTabs();
  renderCart();
  renderProducts();

  // Scroll to the newest tab on the far right
  setTimeout(() => {
    const container = document.getElementById('orderQueueTabs');
    if (container) {
      container.scrollTo({ left: container.scrollWidth, behavior: 'smooth' });
    }
  }, 60);
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
  const newName = prompt('Ganti Nama Antrian / Nomor Meja:\n(Contoh: Meja 5, Mas Joko, Bungkus)', cur.name);
  if (newName && newName.trim()) {
    cur.name = newName.trim();
    saveQueues();
    syncSaveQueues(state.orderQueues);
    renderOrderQueueTabs();
  }
}

export function deleteCurrentActiveQueue() {
  const cur = getActiveQueue();
  if (!cur) return;

  if (state.orderQueues.length <= 1) {
    const itemCount = Object.values(cur.cart).reduce((a, b) => a + b, 0);
    if (itemCount > 0) {
      if (confirm(`Kosongkan semua pesanan pada "${cur.name}"?`)) {
        cur.cart = {};
        saveQueues();
        syncSaveQueues(state.orderQueues);
        renderOrderQueueTabs();
        renderCart();
        renderProducts();
      }
    }
    return;
  }

  const itemCount = Object.values(cur.cart).reduce((a, b) => a + b, 0);
  const msg = itemCount > 0 
    ? `Tutup dan hapus "${cur.name}" yang masih berisi ${itemCount} pesanan?`
    : `Tutup antrian "${cur.name}"?`;

  if (confirm(msg)) {
    deleteOrderQueue(cur.id);
  }
}

export function deleteOrderQueue(queueId, event) {
  if (event) event.stopPropagation();
  const qToDelete = state.orderQueues.find(q => q.id === queueId);
  if (!qToDelete) return;
  
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
  syncSaveQueues(state.orderQueues);
  renderOrderQueueTabs();
  renderCart();
  renderProducts();
}

// ================= CATEGORY & PRODUCT RENDERING =================
export function setCategory(cat) {
  state.currentCategory = cat;
  document.querySelectorAll('.cat-pill').forEach(btn => {
    btn.className = 'cat-pill py-2 px-1 sm:px-4 rounded-xl font-bold text-xs sm:text-sm text-center bg-stone-100 hover:bg-stone-200 text-stone-700 transition flex flex-col sm:flex-row items-center justify-center gap-0.5 sm:gap-1.5 touch-target-large';
  });
  const activeBtn = document.getElementById(`cat-${cat}`);
  if (activeBtn) {
    activeBtn.className = 'cat-pill py-2 px-1 sm:px-4 rounded-xl font-black text-xs sm:text-sm text-center bg-emerald-600 text-stone-950 shadow-md transition flex flex-col sm:flex-row items-center justify-center gap-0.5 sm:gap-1.5 touch-target-large';
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
      <div class="col-span-full py-12 text-center text-stone-400 flex flex-col items-center justify-center gap-2 bg-white rounded-2xl border border-stone-200">
        <span class="material-symbols-rounded text-5xl text-stone-300">search_off</span>
        <p class="font-bold text-sm">Menu tidak ditemukan</p>
      </div>
    `;
    return;
  }

  grid.innerHTML = filtered.map(product => {
    const qty = currentCart[product.id] || 0;
    const hasQty = qty > 0;
    return `
      <div onclick="window.KasirApp.addToCart('${product.id}')" class="relative bg-white active:scale-[0.97] border-2 ${hasQty ? 'border-emerald-600 bg-emerald-50/50 shadow-md ring-2 ring-emerald-400/30' : 'border-stone-200 hover:border-emerald-300 shadow-sm'} rounded-2xl p-2.5 sm:p-4 flex flex-col justify-between cursor-pointer transition touch-target-large">
        
        ${hasQty ? `
          <span class="absolute -top-2 -right-2 bg-emerald-600 text-stone-950 font-black text-xs px-2.5 py-0.5 rounded-full shadow-md">
            ${qty}x
          </span>
        ` : ''}

        <div class="flex items-start justify-between gap-1">
          <div class="w-9 h-9 sm:w-12 sm:h-12 rounded-xl ${hasQty ? 'bg-emerald-600 text-stone-950 font-black' : 'bg-stone-100 text-stone-700'} flex items-center justify-center shrink-0 transition">
            <span class="material-symbols-rounded text-xl sm:text-2xl">${product.icon || 'lunch_dining'}</span>
          </div>
          <span class="text-[10px] font-bold text-stone-500 capitalize px-2 py-0.5 rounded-lg bg-stone-100">${escapeHtml(product.category)}</span>
        </div>

        <div class="mt-2.5">
          <h3 class="font-extrabold text-stone-900 text-xs sm:text-base leading-tight line-clamp-2">${escapeHtml(product.name)}</h3>
          <p class="font-black text-emerald-700 text-sm sm:text-lg mt-0.5">${formatRp(product.price)}</p>
        </div>

        <div class="mt-2 pt-1.5 border-t border-stone-100 flex items-center justify-between text-[11px] font-extrabold ${hasQty ? 'text-emerald-900' : 'text-stone-500'}">
          <span>+ Tambah</span>
          <span class="material-symbols-rounded text-base ${hasQty ? 'text-emerald-700' : 'text-stone-400'}">add_circle</span>
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
    syncSaveQueues(state.orderQueues);
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
  syncSaveQueues(state.orderQueues);
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
    syncSaveQueues(state.orderQueues);
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
    <div class="flex flex-col items-center justify-center h-36 text-stone-400 gap-1.5">
      <span class="material-symbols-rounded text-3xl text-stone-300">touch_app</span>
      <p class="font-bold text-xs sm:text-sm text-center">Sentuh menu untuk menambah pesanan</p>
    </div>
  ` : itemIds.map(id => {
    const p = state.products.find(prod => prod.id === id);
    if (!p) return '';
    const qty = currentCart[id];
    const subtotal = p.price * qty;

    return `
      <div class="py-2.5 flex items-center justify-between gap-1.5 border-b border-stone-100 last:border-0">
        <div class="flex-1 min-w-0">
          <h4 class="font-extrabold text-stone-900 text-xs sm:text-sm truncate">${escapeHtml(p.name)}</h4>
          <p class="text-[11px] font-bold text-stone-500">${formatRp(p.price)} &times; ${qty} = <span class="text-emerald-800 font-black">${formatRp(subtotal)}</span></p>
        </div>
        <div class="flex items-center gap-1 shrink-0">
          <button onclick="window.KasirApp.updateCartQty('${id}', -1)" class="w-7 h-7 rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-800 font-black text-sm flex items-center justify-center touch-target-large transition">-</button>
          <span class="w-5 text-center font-black text-xs text-stone-800">${qty}</span>
          <button onclick="window.KasirApp.updateCartQty('${id}', 1)" class="w-7 h-7 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-stone-950 font-black text-sm flex items-center justify-center touch-target-large shadow-sm transition">+</button>
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
