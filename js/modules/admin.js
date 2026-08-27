/**
 * Kasir Mami - Admin Module (Product CRUD, Data Backup & Restore)
 */

import { state, saveProducts, saveQueues, saveHistory, saveExpenses } from '../state.js';
import { formatRp, escapeHtml } from '../utils.js';
import { renderProducts, renderCart } from './pos.js';

export function renderAdminTable() {
  const container = document.getElementById('adminProductCardList');
  if (!container) return;

  container.innerHTML = state.products.map(p => `
    <div class="p-2.5 sm:p-4 flex items-center justify-between gap-2 hover:bg-slate-50 transition border-b border-slate-100 last:border-0">
      <div class="flex items-center gap-2.5 min-w-0">
        <span class="material-symbols-rounded text-xl sm:text-2xl text-stone-950 p-2 bg-amber-100/80 rounded-xl shrink-0 border border-amber-200">${p.icon || 'lunch_dining'}</span>
        <div class="truncate">
          <h4 class="font-extrabold text-slate-900 text-xs sm:text-base truncate">${escapeHtml(p.name)}</h4>
          <p class="font-black text-m3-secondary text-xs sm:text-base">${formatRp(p.price)} <span class="text-[10px] text-slate-400 font-normal">(${escapeHtml(p.category)})</span></p>
        </div>
      </div>
      <div class="flex items-center gap-1 shrink-0">
        <button onclick="window.KasirApp.openEditProductModal('${p.id}')" class="p-1.5 rounded-xl bg-amber-50 text-amber-900 hover:bg-amber-100 border border-amber-200 font-bold touch-target-large" title="Ubah menu">
          <span class="material-symbols-rounded text-base">edit</span>
        </button>
        <button onclick="window.KasirApp.deleteProduct('${p.id}')" class="p-1.5 rounded-xl bg-red-50 text-red-600 hover:bg-red-100 border border-red-200 font-bold touch-target-large" title="Hapus menu">
          <span class="material-symbols-rounded text-base">delete</span>
        </button>
      </div>
    </div>
  `).join('');
}

export function openAddProductModal() {
  const titleEl = document.getElementById('productModalTitle');
  const editIdEl = document.getElementById('editProductId');
  const nameEl = document.getElementById('prodName');
  const priceEl = document.getElementById('prodPrice');
  const catEl = document.getElementById('prodCategory');
  const iconEl = document.getElementById('prodIcon');
  const modal = document.getElementById('productModal');

  if (titleEl) titleEl.innerText = 'Tambah Menu Baru';
  if (editIdEl) editIdEl.value = '';
  if (nameEl) nameEl.value = '';
  if (priceEl) priceEl.value = '';
  if (catEl) catEl.value = 'makanan';
  if (iconEl) iconEl.value = 'lunch_dining';
  if (modal) modal.classList.remove('hidden');
}

export function openEditProductModal(id) {
  const p = state.products.find(prod => prod.id === id);
  if (!p) return;

  const titleEl = document.getElementById('productModalTitle');
  const editIdEl = document.getElementById('editProductId');
  const nameEl = document.getElementById('prodName');
  const priceEl = document.getElementById('prodPrice');
  const catEl = document.getElementById('prodCategory');
  const iconEl = document.getElementById('prodIcon');
  const modal = document.getElementById('productModal');

  if (titleEl) titleEl.innerText = 'Ubah Menu';
  if (editIdEl) editIdEl.value = p.id;
  if (nameEl) nameEl.value = p.name;
  if (priceEl) priceEl.value = p.price;
  if (catEl) catEl.value = p.category;
  if (iconEl) iconEl.value = p.icon;
  if (modal) modal.classList.remove('hidden');
}

export function closeProductModal() {
  const modal = document.getElementById('productModal');
  if (modal) modal.classList.add('hidden');
}

export function saveProduct(e) {
  if (e) e.preventDefault();

  const id = document.getElementById('editProductId').value;
  const name = document.getElementById('prodName').value.trim();
  const price = parseInt(document.getElementById('prodPrice').value, 10);
  const category = document.getElementById('prodCategory').value;
  const icon = document.getElementById('prodIcon').value;

  if (!name || isNaN(price) || price <= 0) return;

  if (id) {
    const index = state.products.findIndex(p => p.id === id);
    if (index !== -1) {
      state.products[index] = { ...state.products[index], name, price, category, icon };
    }
  } else {
    state.products.push({
      id: 'p_' + Date.now(),
      name,
      price,
      category,
      icon
    });
  }

  saveProducts();
  closeProductModal();
  renderAdminTable();
  renderProducts();
}

export function deleteProduct(id) {
  const p = state.products.find(prod => prod.id === id);
  const prodName = p ? p.name : 'ini';
  if (confirm(`Hapus menu "${prodName}" dari kasir?`)) {
    state.products = state.products.filter(p => p.id !== id);
    state.orderQueues.forEach(q => delete q.cart[id]);
    saveProducts();
    saveQueues();
    renderAdminTable();
    renderProducts();
    renderCart();
  }
}

// ================= BACKUP & RESTORE DATA (JSON) =================
export function exportDataBackup() {
  const backupData = {
    version: 1,
    exportedAt: new Date().toISOString(),
    products: state.products,
    transactions: state.transactions,
    expenses: state.expenses,
    orderQueues: state.orderQueues
  };

  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(backupData, null, 2));
  const downloadAnchor = document.createElement('a');
  downloadAnchor.setAttribute("href", dataStr);
  downloadAnchor.setAttribute("download", `Backup_Kasir_Mami_${new Date().toISOString().slice(0, 10)}.json`);
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();
}

export function importDataBackup(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const data = JSON.parse(e.target.result);
      if (data.products && Array.isArray(data.products)) {
        state.products = data.products;
        saveProducts();
      }
      if (data.transactions && Array.isArray(data.transactions)) {
        state.transactions = data.transactions;
        saveHistory();
      }
      if (data.expenses && Array.isArray(data.expenses)) {
        state.expenses = data.expenses;
        saveExpenses();
      }
      if (data.orderQueues && Array.isArray(data.orderQueues)) {
        state.orderQueues = data.orderQueues;
        state.activeQueueId = data.orderQueues[0]?.id || 'q_1';
        saveQueues();
      }
      alert('✓ Data Kasir Mami berhasil dipulihkan dari file backup!');
      renderProducts();
      renderCart();
      renderAdminTable();
    } catch (err) {
      alert('Format file backup tidak valid!');
    }
  };
  reader.readAsText(file);
}
