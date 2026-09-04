import { state, saveProducts, saveQueues, saveHistory, saveExpenses, saveQrisPayload } from '../state.js';
import { formatRp, escapeHtml, showToast, showConfirmDialog, playClick } from '../utils.js';
import { renderProducts, renderCart } from './pos.js';
import { syncSaveProduct, syncDeleteProduct, forceUploadAllToCloud, syncSaveQrisPayload } from '../firebase.js';
import { decodeQRFromImage, renderQRToContainer, parseQRISMetadata } from '../qris.js';

export function renderAdminSkeletons(count = 5) {
  const container = document.getElementById('adminProductCardList');
  if (!container) return;
  container.innerHTML = Array(count).fill(0).map(() => `
    <div class="p-3 sm:p-4 flex items-center justify-between gap-3 border-b border-stone-100 animate-pulse">
      <div class="flex items-center gap-3 flex-1 min-w-0">
        <div class="w-10 h-10 rounded-xl skeleton-shimmer shrink-0"></div>
        <div class="space-y-1.5 flex-1 max-w-xs">
          <div class="w-3/4 h-4 rounded skeleton-shimmer"></div>
          <div class="w-1/3 h-3.5 rounded skeleton-shimmer"></div>
        </div>
      </div>
      <div class="flex items-center gap-1.5">
        <div class="w-16 h-8 rounded-xl skeleton-shimmer"></div>
        <div class="w-8 h-8 rounded-xl skeleton-shimmer"></div>
      </div>
    </div>
  `).join('');
}

export function renderAdminTable() {
  const container = document.getElementById('adminProductCardList');
  if (!container) return;

  container.innerHTML = state.products.map(p => {
    const isReady = p.isAvailable !== false && (!p.trackStock || (p.stock || 0) > 0);
    return `
      <div class="p-3 sm:p-4 flex items-center justify-between gap-3 hover:bg-stone-50 transition border-b border-stone-100 last:border-0 ${!isReady ? 'bg-stone-50/60' : ''}">
        <div class="flex items-center gap-3 min-w-0">
          <span class="material-symbols-rounded text-xl sm:text-2xl text-stone-950 p-2.5 ${isReady ? 'bg-emerald-100/80' : 'bg-stone-200 text-stone-500'} rounded-2xl shrink-0 border border-emerald-200">${p.icon || 'lunch_dining'}</span>
          <div class="truncate">
            <div class="flex items-center gap-2 flex-wrap">
              <h4 class="font-extrabold text-stone-900 text-sm sm:text-base truncate ${!isReady ? 'line-through text-stone-500' : ''}">${escapeHtml(p.name)}</h4>
              ${p.trackStock ? `
                <span class="px-2 py-0.5 rounded-lg text-xs font-black ${(p.stock || 0) > 0 ? 'bg-emerald-100 text-emerald-900 border border-emerald-300' : 'bg-red-100 text-red-700 border border-red-300'}">
                  Stok: ${p.stock || 0} Porsi
                </span>
              ` : `
                <span class="px-2 py-0.5 rounded-lg text-xs font-extrabold bg-stone-100 text-stone-600 border border-stone-200">
                  Stok Bebas (Ready)
                </span>
              `}
            </div>
            <p class="font-black text-emerald-800 text-xs sm:text-sm mt-0.5">${formatRp(p.price)} <span class="text-[11px] text-stone-400 font-medium">(${escapeHtml(p.category)})</span></p>
          </div>
        </div>
        <div class="flex items-center gap-1.5 sm:gap-2 shrink-0">
          <!-- 1-Tap Toggle Status Ready / Habis -->
          <button onclick="window.KasirApp.toggleProductAvailability('${p.id}')" 
            class="px-2.5 sm:px-3 py-2 rounded-xl font-black text-xs transition touch-target-large flex items-center gap-1 border ${isReady ? 'bg-emerald-50 text-emerald-950 border-emerald-300 hover:bg-emerald-100' : 'bg-red-50 text-red-700 border-red-300 hover:bg-red-100'}"
            title="Klik untuk ubah status Ready/Habis">
            <span class="material-symbols-rounded text-base">${isReady ? 'check_circle' : 'cancel'}</span>
            <span>${isReady ? 'Ready' : 'Habis'}</span>
          </button>
          
          <!-- Tombol Ubah Menu (Satu Arah & Lengkap) -->
          <button onclick="window.KasirApp.openEditProductModal('${p.id}')" 
            class="px-2.5 sm:px-3 py-2 rounded-xl bg-stone-100 text-stone-800 hover:bg-emerald-100 hover:text-emerald-900 border border-stone-200 font-black text-xs flex items-center gap-1 transition touch-target-large" 
            title="Ubah nama, harga, atau stok menu">
            <span class="material-symbols-rounded text-base">edit</span>
            <span class="hidden sm:inline">Ubah</span>
          </button>
          
          <!-- Hapus Menu -->
          <button onclick="window.KasirApp.deleteProduct('${p.id}')" 
            class="p-2 rounded-xl bg-red-50 text-red-600 hover:bg-red-100 border border-red-200 font-bold touch-target-large" 
            title="Hapus menu">
            <span class="material-symbols-rounded text-base">delete</span>
          </button>
        </div>
      </div>
    `;
  }).join('');
}

export function toggleProductAvailability(id) {
  playClick('pop');
  const p = state.products.find(prod => prod.id === id);
  if (!p) return;
  
  const currentReady = p.isAvailable !== false && (!p.trackStock || (p.stock || 0) > 0);
  p.isAvailable = !currentReady;
  
  if (p.isAvailable && p.trackStock && (p.stock || 0) <= 0) {
    p.stock = 10; // Restock ke 10 jika sebelumnya 0
  }

  saveProducts();
  syncSaveProduct(p);
  renderAdminTable();
  renderProducts();
  showToast(`Menu "${p.name}" sekarang ${p.isAvailable ? 'READY / TERSEDIA' : 'HABIS / KOSONG'}`, p.isAvailable ? 'success' : 'warning');
}

export function openAddProductModal() {
  playClick('pop');
  const titleEl = document.getElementById('productModalTitle');
  const editIdEl = document.getElementById('editProductId');
  const nameEl = document.getElementById('prodName');
  const priceEl = document.getElementById('prodPrice');
  const catEl = document.getElementById('prodCategory');
  const iconEl = document.getElementById('prodIcon');
  const isAvailEl = document.getElementById('prodIsAvailable');
  const stockEl = document.getElementById('prodStock');
  const modal = document.getElementById('productModal');

  if (titleEl) titleEl.innerText = 'Tambah Menu Baru';
  if (editIdEl) editIdEl.value = '';
  if (nameEl) nameEl.value = '';
  if (priceEl) priceEl.value = '';
  if (catEl) catEl.value = 'makanan';
  if (iconEl) iconEl.value = 'lunch_dining';
  if (isAvailEl) isAvailEl.checked = true;
  if (stockEl) stockEl.value = '';
  if (modal) modal.classList.remove('hidden');
}

export function openEditProductModal(id) {
  playClick('pop');
  const p = state.products.find(prod => prod.id === id);
  if (!p) return;

  const titleEl = document.getElementById('productModalTitle');
  const editIdEl = document.getElementById('editProductId');
  const nameEl = document.getElementById('prodName');
  const priceEl = document.getElementById('prodPrice');
  const catEl = document.getElementById('prodCategory');
  const iconEl = document.getElementById('prodIcon');
  const isAvailEl = document.getElementById('prodIsAvailable');
  const stockEl = document.getElementById('prodStock');
  const modal = document.getElementById('productModal');

  if (titleEl) titleEl.innerText = `Ubah Menu: ${p.name}`;
  if (editIdEl) editIdEl.value = p.id;
  if (nameEl) nameEl.value = p.name;
  if (priceEl) priceEl.value = p.price;
  if (catEl) catEl.value = p.category;
  if (iconEl) iconEl.value = p.icon;
  if (isAvailEl) isAvailEl.checked = p.isAvailable !== false;
  if (stockEl) {
    stockEl.value = (p.trackStock && p.stock !== null && p.stock !== undefined) ? p.stock : '';
  }
  if (modal) modal.classList.remove('hidden');
}

export function closeProductModal() {
  playClick('pop');
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
  const isAvailable = document.getElementById('prodIsAvailable').checked;
  const stockInputRaw = document.getElementById('prodStock').value.trim();

  if (!name || isNaN(price) || price <= 0) {
    showToast('Harap isi nama dan harga menu dengan benar', 'warning');
    return;
  }

  // Jika input stok diisi angka -> aktifkan batasan stok porsi. Jika dikosongkan -> stok bebas.
  const trackStock = stockInputRaw !== '';
  const stock = trackStock ? Math.max(0, parseInt(stockInputRaw, 10) || 0) : null;
  const finalAvailable = trackStock ? (stock > 0 && isAvailable) : isAvailable;

  let productObj = null;

  if (id) {
    const index = state.products.findIndex(p => p.id === id);
    if (index !== -1) {
      productObj = { 
        ...state.products[index], 
        name, 
        price, 
        category, 
        icon,
        isAvailable: finalAvailable,
        trackStock,
        stock
      };
      state.products[index] = productObj;
    }
  } else {
    productObj = {
      id: 'p_' + Date.now(),
      name,
      price,
      category,
      icon,
      isAvailable: finalAvailable,
      trackStock,
      stock
    };
    state.products.unshift(productObj);
  }

  saveProducts();
  if (productObj) {
    syncSaveProduct(productObj);
  }

  closeProductModal();
  renderAdminTable();
  renderProducts();
  showToast(`Menu "${name}" berhasil disimpan! ${trackStock ? `(Stok: ${stock} Porsi)` : '(Stok Bebas)'}`, 'success');
}

export async function deleteProduct(id) {
  const p = state.products.find(prod => prod.id === id);
  const prodName = p ? p.name : 'ini';
  const ok = await showConfirmDialog({
    title: 'Hapus Menu Kasir',
    message: `Hapus menu "${prodName}" dari daftar kasir?`,
    confirmText: 'Hapus Menu',
    confirmType: 'danger',
    icon: 'delete'
  });
  if (ok) {
    state.products = state.products.filter(p => p.id !== id);
    state.orderQueues.forEach(q => delete q.cart[id]);
    saveProducts();
    saveQueues();
    syncDeleteProduct(id);
    renderAdminTable();
    renderProducts();
    renderCart();
    showToast(`Menu "${prodName}" telah dihapus.`, 'info');
  }
}

// ================= QRIS SETTINGS & IMAGE UPLOAD =================
export function openQrisModal() {
  playClick('pop');
  const modal = document.getElementById('qrisConfigModal');
  const inputEl = document.getElementById('qrisPayloadInput');
  const customNameEl = document.getElementById('qrisCustomStoreName');
  if (inputEl) inputEl.value = state.qrisPayload || '';
  if (customNameEl) customNameEl.value = state.storeProfile?.name || '';
  renderQrisPreview(state.qrisPayload);
  if (modal) modal.classList.remove('hidden');
}

export function closeQrisModal() {
  playClick('pop');
  const modal = document.getElementById('qrisConfigModal');
  if (modal) modal.classList.add('hidden');
}

export function renderQrisPreview(payload) {
  const containerEl = document.getElementById('qrisPreviewContainer');
  const text = (payload || state.qrisPayload || '').trim();
  if (containerEl && text) {
    renderQRToContainer(containerEl, text, 140);
  }

  // Parse and display metadata in preview
  if (text.startsWith('000201')) {
    const meta = parseQRISMetadata(text);
    const metaInfoEl = document.getElementById('qrisMetaInfoArea');
    if (metaInfoEl) {
      metaInfoEl.innerHTML = `
        <div class="bg-emerald-50 rounded-xl p-2.5 border border-emerald-200 text-left text-xs flex flex-col gap-1 w-full">
          <div class="flex items-center justify-between">
            <span class="font-extrabold text-emerald-950">${escapeHtml(meta.merchantName)}</span>
            <span class="px-2 py-0.5 rounded bg-emerald-200 text-emerald-900 text-[10px] font-black">${escapeHtml(meta.acquirer)}</span>
          </div>
          <p class="text-[11px] text-stone-600">NMID: <strong class="text-stone-900">${meta.nmid || '-'}</strong> | Kota: ${escapeHtml(meta.city || '-')}</p>
        </div>
      `;
      metaInfoEl.classList.remove('hidden');
    }
  }
}

export async function handleQrisImageUpload(event) {
  const file = event.target.files[0];
  if (!file) return;

  const statusEl = document.getElementById('qrisScanStatus');
  if (statusEl) {
    statusEl.innerText = '⏳ Sedang memindai gambar QRIS...';
    statusEl.className = 'text-xs font-bold text-emerald-700 block';
  }

  try {
    const rawPayload = await decodeQRFromImage(file);
    if (!rawPayload.startsWith('000201')) {
      throw new Error('QR Code yang terbaca bukan standar QRIS Indonesia (EMVCo).');
    }

    const inputEl = document.getElementById('qrisPayloadInput');
    if (inputEl) inputEl.value = rawPayload;

    renderQrisPreview(rawPayload);

    const meta = parseQRISMetadata(rawPayload);
    if (statusEl) {
      statusEl.innerText = `Berhasil membaca QRIS "${meta.merchantName}". Klik "Simpan QRIS" di bawah.`;
      statusEl.className = 'text-xs font-bold text-emerald-700 block';
    }
  } catch (err) {
    console.error('Scan QRIS error:', err);
    if (statusEl) {
      statusEl.innerText = 'Gagal: ' + (err.message || 'Tidak dapat membaca QRIS');
      statusEl.className = 'text-xs font-bold text-red-600 block';
    }
    showToast('Gagal membaca gambar QRIS. Pastikan foto tegak dan jelas.', 'error');
  }
}

export function saveQrisSettings(e) {
  if (e) e.preventDefault();
  const inputEl = document.getElementById('qrisPayloadInput');
  const customNameEl = document.getElementById('qrisCustomStoreName');
  const payload = inputEl ? inputEl.value.trim() : '';
  const customName = customNameEl ? customNameEl.value.trim() : '';

  if (!payload || !payload.startsWith('000201')) {
    showToast('Format kode QRIS tidak valid. Harus diawali dengan "000201".', 'warning');
    return;
  }

  saveQrisPayload(payload);
  if (customName && customName !== state.storeProfile.name) {
    state.storeProfile.name = customName;
    saveStoreProfile();
  }
  syncSaveQrisPayload(payload);
  closeQrisModal();
  showToast(`Pengaturan QRIS & nama toko [${state.storeProfile.name}] berhasil disimpan!`, 'success');
}

// ================= BACKUP & RESTORE DATA (JSON) =================
export function exportDataBackup() {
  const backupData = {
    version: 1,
    exportedAt: new Date().toISOString(),
    products: state.products,
    transactions: state.transactions,
    expenses: state.expenses,
    orderQueues: state.orderQueues,
    qrisPayload: state.qrisPayload
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
      if (data.qrisPayload && typeof data.qrisPayload === 'string') {
        saveQrisPayload(data.qrisPayload);
        syncSaveQrisPayload(data.qrisPayload);
      }
      showToast('Data Kasir Mami berhasil dipulihkan dari backup!', 'success');
      forceUploadAllToCloud();
      renderProducts();
      renderCart();
      renderAdminTable();
    } catch (err) {
      showToast('Format file backup tidak valid!', 'error');
    }
  };
  reader.readAsText(file);
}

// ================= BULK MENU TEXT IMPORT =================
export const USER_SAMPLE_MENU_TEXT = `Makanan nasi Ayam serbuk 15k
Nasi telor satu 10k
Telor dobel 13k
Mie jumbo/dobel 19k tambah telor 13k
Mie biasa 7k tambah telor 10k
Aneka minuman saset 5k
Gud day 6k
ABC kelepon 6k
Nutri sari dll 5k
Kopi hitam 5k
Kopi susu 7k
Teh tarik 7k
Es teh solo 4k
Josu 5k
Millo 8k
Aneka minuman botol 5k
Sprit 7k
Gud day 7k
Susu ultra 7k
Sijiro 4k
Mineralle 5k
AQua 5k`;

let bulkParsedProducts = [];

function parsePriceNumber(str) {
  if (!str) return 0;
  const clean = str.trim().toLowerCase().replace(/rp\.?\s*/g, '');
  if (clean.endsWith('k') || clean.endsWith('rb') || clean.endsWith('ribu')) {
    const num = parseFloat(clean.replace(/[^\d.,]/g, '').replace(',', '.'));
    return Math.round(num * 1000);
  }
  const digits = clean.replace(/[^\d]/g, '');
  const num = parseInt(digits, 10) || 0;
  if (num > 0 && num < 1000) return num * 1000;
  return num;
}

function cleanItemTitle(str) {
  const words = (str || '').trim().split(/\s+/);
  return words.map(w => {
    if (/^(dll|dan|atau|ke|di|yang)$/i.test(w)) return w.toLowerCase();
    if (/^(abc|qris|pos|josu|bbq)$/i.test(w)) return w.toUpperCase();
    return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
  }).join(' ');
}

function pickMenuIcon(name, category) {
  const n = (name || '').toLowerCase();
  if (/mie|ramen|bakso|bihun|kwetiau/i.test(n)) return 'ramen_dining';
  if (/nasi|ayam|bebek|sate|burger|daging|ikan/i.test(n)) return 'lunch_dining';
  if (/telur|telor/i.test(n)) return 'egg';
  if (/kopi|coffee|teh|tea/i.test(n)) return 'local_cafe';
  if (/minuman|es |susu|josu|milo|millo|sprit|aqua|mineral|botol|saset/i.test(n)) return 'local_drink';
  if (/roti|pisang|tahu|tempe|gorengan|camilan|snack/i.test(n)) return 'bakery_dining';
  return category === 'minuman' ? 'local_drink' : (category === 'camilan' ? 'bakery_dining' : 'lunch_dining');
}

export function parseBulkMenuText(raw) {
  const lines = (raw || '').split('\n');
  const items = [];
  let currentCategory = 'makanan';

  for (let rawLine of lines) {
    let line = rawLine.trim();
    if (!line) continue;

    // Deteksi header kategori jika ada
    if (/^===?\s*makanan/i.test(line) || /^makanan\s*:/i.test(line)) {
      currentCategory = 'makanan';
      continue;
    }
    if (/^===?\s*minuman/i.test(line) || /^minuman\s*:/i.test(line)) {
      currentCategory = 'minuman';
      continue;
    }
    if (/^===?\s*camilan/i.test(line) || /^camilan\s*:/i.test(line)) {
      currentCategory = 'camilan';
      continue;
    }

    if (/^makanan\s+/i.test(line)) {
      currentCategory = 'makanan';
    } else if (/aneka minuman/i.test(line) || /^minuman\s+/i.test(line)) {
      currentCategory = 'minuman';
    }

    // Periksa baris ganda dengan ekstra/varian (misal: 'Mie biasa 7k tambah telor 10k')
    const tambahMatch = line.match(/(.+?)\s+(\d+[kK]?|\d+\.\d{3}|rp\.?\s*\d+)\s+(?:tambah|\+)\s+(.+?)\s+(\d+[kK]?|\d+\.\d{3}|rp\.?\s*\d+)$/i);
    if (tambahMatch) {
      let mainName = tambahMatch[1].replace(/^(makanan|minuman|camilan)\s+/i, '').trim();
      const mainPrice = parsePriceNumber(tambahMatch[2]);
      const addName = tambahMatch[3].trim();
      const addPrice = parsePriceNumber(tambahMatch[4]);
      
      items.push({
        id: 'p_' + Date.now() + '_' + Math.floor(Math.random() * 100000),
        name: cleanItemTitle(mainName),
        price: mainPrice,
        category: currentCategory,
        icon: pickMenuIcon(mainName, currentCategory),
        isAvailable: true,
        trackStock: false,
        stock: null
      });
      items.push({
        id: 'p_' + (Date.now() + 1) + '_' + Math.floor(Math.random() * 100000),
        name: cleanItemTitle(`${mainName} + ${addName}`),
        price: addPrice,
        category: currentCategory,
        icon: pickMenuIcon(mainName, currentCategory),
        isAvailable: true,
        trackStock: false,
        stock: null
      });
      continue;
    }

    // Baris reguler: Ekstrak nama dan harga
    const priceMatch = line.match(/(.*?)\s+(\d+[kK]|\d+rb|\d+\.\d{3}|rp\.?\s*\d+|\d{4,6}|\b\d{1,3}\b)$/i);
    if (priceMatch) {
      let name = priceMatch[1].replace(/^(makanan|minuman|camilan)\s+/i, '').trim();
      let price = parsePriceNumber(priceMatch[2]);
      if (!name) name = line;
      
      let cat = currentCategory;
      if (/kopi|teh|susu|josu|millo|milo|sprit|aqua|mineral|nutri|jus|drink|kelepon|saset|botol/i.test(name)) {
        cat = 'minuman';
      } else if (/nasi|mie|ayam|telor|bebek|bakso|gorengan/i.test(name)) {
        cat = 'makanan';
      }

      items.push({
        id: 'p_' + Date.now() + '_' + Math.floor(Math.random() * 100000),
        name: cleanItemTitle(name),
        price: price,
        category: cat,
        icon: pickMenuIcon(name, cat),
        isAvailable: true,
        trackStock: false,
        stock: null
      });
    } else {
      items.push({
        id: 'p_' + Date.now() + '_' + Math.floor(Math.random() * 100000),
        name: cleanItemTitle(line),
        price: 0,
        category: currentCategory,
        icon: pickMenuIcon(line, currentCategory),
        isAvailable: true,
        trackStock: false,
        stock: null
      });
    }
  }
  return items;
}

export function openBulkImportModal(initialText = '') {
  playClick('pop');
  const modal = document.getElementById('bulkImportModal');
  const textarea = document.getElementById('bulkMenuTextInput');
  if (textarea) {
    textarea.value = initialText || '';
  }
  handleBulkTextInput();
  if (modal) modal.classList.remove('hidden');
}

export function closeBulkImportModal() {
  playClick('pop');
  const modal = document.getElementById('bulkImportModal');
  if (modal) modal.classList.add('hidden');
}

export function loadUserSampleMenu() {
  playClick('tap');
  const textarea = document.getElementById('bulkMenuTextInput');
  if (textarea) {
    textarea.value = USER_SAMPLE_MENU_TEXT;
  }
  handleBulkTextInput();
  showToast('Daftar menu berhasil ditempel.', 'info', 2000);
}

export function handleBulkTextInput() {
  const textarea = document.getElementById('bulkMenuTextInput');
  const raw = textarea ? textarea.value : '';
  bulkParsedProducts = parseBulkMenuText(raw);
  renderBulkPreviewList();
}

export function renderBulkPreviewList() {
  const container = document.getElementById('bulkImportPreviewList');
  const badge = document.getElementById('bulkPreviewCountBadge');
  const applyBtn = document.getElementById('btnApplyBulkImport');
  const btnText = document.getElementById('btnApplyBulkImportText');

  const count = bulkParsedProducts.length;
  if (badge) badge.textContent = `${count} Menu`;
  if (btnText) btnText.textContent = count > 0 ? `Simpan & Terapkan (${count} Menu)` : 'Simpan & Terapkan';
  if (applyBtn) applyBtn.disabled = count === 0;

  if (!container) return;

  if (count === 0) {
    container.innerHTML = `
      <div class="p-6 text-center text-stone-400 bg-stone-50 rounded-2xl border border-dashed border-stone-200">
        <span class="material-symbols-rounded text-3xl mb-1 text-stone-300">receipt_long</span>
        <p class="text-xs font-bold">Belum ada menu yang terdeteksi.</p>
        <p class="text-[11px] text-stone-400 mt-0.5">Ketik atau tempel teks menu di atas, atau klik "Tempel Menu Anda".</p>
      </div>
    `;
    return;
  }

  container.innerHTML = `
    <div class="space-y-2 max-h-64 overflow-y-auto custom-scroll pr-1">
      ${bulkParsedProducts.map((item, idx) => `
        <div class="flex items-center gap-2 p-2 bg-stone-50 rounded-xl border border-stone-200">
          <span class="material-symbols-rounded text-lg text-emerald-700 shrink-0 select-none">${item.icon}</span>
          <select onchange="window.KasirApp.updateBulkPreviewRow(${idx}, 'category', this.value)"
            class="p-1.5 rounded-lg bg-white border border-stone-300 text-xs font-bold text-stone-800 shrink-0">
            <option value="makanan" ${item.category === 'makanan' ? 'selected' : ''}>Makanan</option>
            <option value="minuman" ${item.category === 'minuman' ? 'selected' : ''}>Minuman</option>
            <option value="camilan" ${item.category === 'camilan' ? 'selected' : ''}>Camilan</option>
            <option value="topping" ${item.category === 'topping' ? 'selected' : ''}>Topping</option>
          </select>
          <input type="text" value="${escapeHtml(item.name)}" oninput="window.KasirApp.updateBulkPreviewRow(${idx}, 'name', this.value)"
            class="flex-1 p-1.5 rounded-lg bg-white border border-stone-300 text-xs font-bold text-stone-900 outline-none focus:border-sky-600 shadow-2xs">
          <div class="flex items-center gap-1 shrink-0">
            <span class="text-[11px] font-bold text-stone-500">Rp</span>
            <input type="number" value="${item.price}" oninput="window.KasirApp.updateBulkPreviewRow(${idx}, 'price', parseInt(this.value, 10) || 0)"
              class="w-20 p-1.5 rounded-lg bg-white border border-stone-300 text-xs font-black text-emerald-800 outline-none focus:border-sky-600 shadow-2xs">
          </div>
          <button type="button" onclick="window.KasirApp.deleteBulkPreviewRow(${idx})"
            class="w-7 h-7 rounded-lg text-rose-500 hover:bg-rose-100 flex items-center justify-center shrink-0 transition" title="Hapus">
            <span class="material-symbols-rounded text-base">close</span>
          </button>
        </div>
      `).join('')}
    </div>
  `;
}

export function updateBulkPreviewRow(index, field, value) {
  if (bulkParsedProducts[index]) {
    bulkParsedProducts[index][field] = value;
    if (field === 'name' || field === 'category') {
      bulkParsedProducts[index].icon = pickMenuIcon(bulkParsedProducts[index].name, bulkParsedProducts[index].category);
    }
  }
}

export function deleteBulkPreviewRow(index) {
  playClick('pop');
  if (index >= 0 && index < bulkParsedProducts.length) {
    bulkParsedProducts.splice(index, 1);
    renderBulkPreviewList();
  }
}

export function applyBulkMenuImport() {
  playClick('pop');
  if (!bulkParsedProducts || bulkParsedProducts.length === 0) {
    showToast('Tidak ada menu untuk disimpan.', 'warning', 2000);
    return;
  }

  const modeRadios = document.getElementsByName('bulkImportMode');
  let mode = 'append';
  for (const r of modeRadios) {
    if (r.checked) {
      mode = r.value;
      break;
    }
  }

  if (mode === 'replace') {
    state.products = [...bulkParsedProducts];
  } else {
    // Append (cek duplikasi nama agar tidak ganda persis)
    const existingNames = new Set(state.products.map(p => p.name.toLowerCase()));
    for (const item of bulkParsedProducts) {
      if (existingNames.has(item.name.toLowerCase())) {
        // Berikan ID baru jika tetap ditambahkan
        item.id = 'p_' + Date.now() + '_' + Math.floor(Math.random() * 100000);
      }
      state.products.push(item);
    }
  }

  saveProducts();
  bulkParsedProducts.forEach(p => syncSaveProduct(p));

  closeBulkImportModal();
  renderAdminTable();
  renderProducts();

  showToast(`${bulkParsedProducts.length} menu berhasil disimpan!`, 'success', 3000);
}
