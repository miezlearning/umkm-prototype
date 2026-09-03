/**
 * Kasir Mami - Financial Report & Bookkeeping Module
 */

import { state, saveExpenses, saveHistory } from '../state.js';
import { formatRp, formatDateShort, formatDateFull, escapeHtml, showToast, showConfirmDialog, playClick } from '../utils.js';
import { showReceipt } from './payment.js';
import { 
  syncAddExpense, 
  syncDeleteExpense, 
  syncDeleteTransaction, 
  syncClearTodayData, 
  syncClearAllHistory 
} from '../firebase.js';

export function setReportPeriod(period) {
  playClick('switch');
  state.currentPeriod = period;
  ['today', 'month', 'all'].forEach(p => {
    const btn = document.getElementById(`period-${p}`);
    if (btn) {
      if (p === period) {
        btn.className = 'period-btn px-4 py-2 rounded-xl font-black text-xs sm:text-sm bg-emerald-700 text-white shadow-sm transition';
      } else {
        btn.className = 'period-btn px-4 py-2 rounded-xl font-extrabold text-xs sm:text-sm text-stone-600 hover:text-stone-900 transition';
      }
    }
  });
  renderFinancialReport();
}

export function filterByPeriod(items) {
  const now = new Date();
  return items.filter(item => {
    const itemDate = new Date(item.date);
    if (state.currentPeriod === 'today') {
      return itemDate.toDateString() === now.toDateString();
    } else if (state.currentPeriod === 'month') {
      return itemDate.getMonth() === now.getMonth() && itemDate.getFullYear() === now.getFullYear();
    }
    return true; // 'all'
  });
}

export function renderReportSkeletons() {
  const txContainer = document.getElementById('transactionHistoryList');
  const expContainer = document.getElementById('expenseHistoryList');
  const skeletonItem = `
    <div class="py-3 flex items-center justify-between gap-3 border-b border-stone-100 animate-pulse">
      <div class="space-y-1.5 flex-1">
        <div class="w-24 h-4 rounded skeleton-shimmer"></div>
        <div class="w-48 h-3 rounded skeleton-shimmer"></div>
      </div>
      <div class="w-8 h-8 rounded-xl skeleton-shimmer shrink-0"></div>
    </div>
  `;
  if (txContainer) txContainer.innerHTML = Array(4).fill(skeletonItem).join('');
  if (expContainer) expContainer.innerHTML = Array(3).fill(skeletonItem).join('');
}

export function renderFinancialReport() {
  const filteredTx = filterByPeriod(state.transactions);
  const filteredExp = filterByPeriod(state.expenses);

  let totalRevenue = 0;
  let totalCash = 0;
  let totalQris = 0;
  const itemSalesCounter = {};

  filteredTx.forEach(tx => {
    totalRevenue += tx.total;
    if (tx.method === 'QRIS') {
      totalQris += tx.total;
    } else {
      totalCash += tx.total;
    }

    tx.items.forEach(i => {
      itemSalesCounter[i.name] = (itemSalesCounter[i.name] || 0) + i.qty;
    });
  });

  let totalExpenses = 0;
  filteredExp.forEach(e => {
    totalExpenses += e.amount;
  });

  const netProfit = totalRevenue - totalExpenses;

  // 1. Update Kartu Metrik
  const revEl = document.getElementById('statTotalRevenue');
  const revSubEl = document.getElementById('statRevenueSub');
  const expEl = document.getElementById('statTotalExpenses');
  const expSubEl = document.getElementById('statExpenseSub');
  const netProfitEl = document.getElementById('statNetProfit');
  const cashEl = document.getElementById('statCashTotal');
  const qrisEl = document.getElementById('statQrisTotal');

  if (revEl) revEl.innerText = formatRp(totalRevenue);
  if (revSubEl) revSubEl.innerText = `${filteredTx.length} Transaksi Selesai`;

  if (expEl) expEl.innerText = formatRp(totalExpenses);
  if (expSubEl) expSubEl.innerText = `${filteredExp.length} Catatan Biaya`;

  if (netProfitEl) {
    netProfitEl.innerText = formatRp(netProfit);
    netProfitEl.className = netProfit >= 0
      ? 'text-xl sm:text-3xl font-black text-emerald-700 mt-1 truncate'
      : 'text-xl sm:text-3xl font-black text-red-600 mt-1 truncate';
  }

  if (cashEl) cashEl.innerText = formatRp(totalCash);
  if (qrisEl) qrisEl.innerText = formatRp(totalQris);

  // 2. Render Widget Menu Terlaris
  const topList = document.getElementById('topSellingList');
  if (topList) {
    const sortedItems = Object.entries(itemSalesCounter).sort((a, b) => b[1] - a[1]).slice(0, 4);
    if (sortedItems.length === 0) {
      topList.innerHTML = `<div class="col-span-full text-center text-stone-400 text-xs py-2 font-bold">Belum ada penjualan menu pada periode ini</div>`;
    } else {
      topList.innerHTML = sortedItems.map(([name, qty], idx) => `
        <div class="bg-emerald-50/80 border border-emerald-300/80 p-2 rounded-xl flex items-center justify-between shadow-sm">
          <div class="truncate">
            <span class="text-[10px] font-black text-emerald-900">#${idx + 1}</span>
            <p class="font-extrabold text-stone-800 text-xs truncate">${escapeHtml(name)}</p>
          </div>
          <span class="px-2 py-0.5 bg-emerald-300 text-stone-900 font-black text-xs rounded-lg">${qty}x</span>
        </div>
      `).join('');
    }
  }

  // 3. Render Riwayat Penjualan dengan Tombol Cetak & Hapus Satuan
  const txContainer = document.getElementById('txHistoryCardList');
  if (txContainer) {
    if (filteredTx.length === 0) {
      txContainer.innerHTML = `<div class="py-6 text-center text-stone-400 font-bold text-xs">Belum ada transaksi penjualan di periode ini</div>`;
    } else {
      txContainer.innerHTML = filteredTx.map(tx => {
        const dateStr = formatDateShort(tx.date);
        const summaryItems = tx.items.map(i => `${i.qty}x ${escapeHtml(i.name)}`).join(', ');

        return `
          <div class="py-2.5 flex items-center justify-between gap-1.5 hover:bg-stone-50 transition border-b border-stone-100 last:border-0">
            <div class="min-w-0 flex-1">
              <div class="flex items-center gap-1.5 flex-wrap">
                <span class="font-black text-stone-900 text-xs sm:text-sm">${formatRp(tx.total)}</span>
                <span class="text-[10px] text-stone-500 font-bold">${dateStr}</span>
                <span class="text-[9px] ${tx.method === 'QRIS' ? 'bg-emerald-100 text-emerald-900 font-black' : 'bg-stone-100 text-stone-800 font-black'} px-1.5 py-0.2 rounded">${tx.method || 'TUNAI'}</span>
              </div>
              <p class="text-[11px] text-stone-600 truncate mt-0.5">${summaryItems}</p>
            </div>
            <div class="flex items-center gap-1 shrink-0">
              <button onclick='window.KasirApp.reprintTx("${tx.id}")' class="p-1.5 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 font-bold transition touch-target-large" title="Lihat / Cetak Struk">
                <span class="material-symbols-rounded text-base">receipt</span>
              </button>
              <button onclick='window.KasirApp.deleteTransaction("${tx.id}")' class="p-1.5 rounded-xl bg-red-50 hover:bg-red-100 text-red-600 font-bold transition touch-target-large" title="Hapus transaksi ini (koreksi kesalahan input)">
                <span class="material-symbols-rounded text-base">delete</span>
              </button>
            </div>
          </div>
        `;
      }).join('');
    }
  }

  // 4. Render Riwayat Pengeluaran
  const expContainer = document.getElementById('expenseHistoryList');
  if (expContainer) {
    if (filteredExp.length === 0) {
      expContainer.innerHTML = `<div class="py-6 text-center text-stone-400 font-bold text-xs">Belum ada catatan pengeluaran di periode ini</div>`;
    } else {
      expContainer.innerHTML = filteredExp.map(exp => {
        const dateStr = formatDateShort(exp.date);
        return `
          <div class="py-2.5 flex items-center justify-between gap-1.5 hover:bg-stone-50 transition border-b border-stone-100 last:border-0">
            <div class="min-w-0 flex-1">
              <div class="flex items-center gap-1.5">
                <span class="font-black text-red-600 text-xs sm:text-sm">- ${formatRp(exp.amount)}</span>
                <span class="text-[10px] text-stone-500 font-bold">${dateStr}</span>
              </div>
              <p class="text-[11px] font-bold text-stone-700 truncate mt-0.5">${escapeHtml(exp.name)} <span class="text-[10px] text-stone-400 font-normal">(${escapeHtml(exp.category)})</span></p>
            </div>
            <button onclick="window.KasirApp.deleteExpense('${exp.id}')" class="p-1.5 rounded-xl text-red-500 hover:bg-red-50 font-bold transition touch-target-large" title="Hapus catatan">
              <span class="material-symbols-rounded text-base">delete</span>
            </button>
          </div>
        `;
      }).join('');
    }
  }
}

export function reprintTx(txId) {
  const tx = state.transactions.find(t => t.id === txId);
  if (tx) {
    showReceipt(tx);
  }
}

/**
 * HAPUS DATA HARI INI (Transaksi Penjualan & Pengeluaran Hari Ini Saja)
 */
export async function clearTodayData() {
  const now = new Date();
  const todayStr = now.toDateString();

  const todayTxCount = state.transactions.filter(t => new Date(t.date).toDateString() === todayStr).length;
  const todayExpCount = state.expenses.filter(e => new Date(e.date).toDateString() === todayStr).length;

  if (todayTxCount === 0 && todayExpCount === 0) {
    showToast('Tidak ada catatan transaksi penjualan atau pengeluaran pada hari ini.', 'info');
    return;
  }

  const ok = await showConfirmDialog({
    title: 'Hapus Data Hari Ini?',
    message: `Hapus ${todayTxCount} transaksi penjualan & ${todayExpCount} pengeluaran hari ini? (Data hari kemarin tetap aman tersimpan).`,
    confirmText: 'Hapus Data Hari Ini',
    confirmType: 'danger',
    icon: 'delete_sweep'
  });

  if (ok) {
    state.transactions = state.transactions.filter(t => new Date(t.date).toDateString() !== todayStr);
    state.expenses = state.expenses.filter(e => new Date(e.date).toDateString() !== todayStr);
    saveHistory();
    saveExpenses();
    syncClearTodayData();
    renderFinancialReport();
    showToast('Data penjualan dan pengeluaran hari ini berhasil dihapus.', 'success');
  }
}

/**
 * HAPUS SATU TRANSAKSI SPESIFIK (Untuk koreksi jika salah input)
 */
export async function deleteTransaction(txId) {
  const tx = state.transactions.find(t => t.id === txId);
  if (!tx) return;

  const itemSummary = tx.items.map(i => `${i.qty}x ${i.name}`).join(', ');
  const ok = await showConfirmDialog({
    title: 'Hapus Transaksi Penjualan',
    message: `Hapus transaksi ${tx.orderName || 'Pesanan'} senilai ${formatRp(tx.total)} (${itemSummary})?`,
    confirmText: 'Hapus Transaksi',
    confirmType: 'danger',
    icon: 'delete'
  });

  if (ok) {
    state.transactions = state.transactions.filter(t => t.id !== txId);
    saveHistory();
    syncDeleteTransaction(txId);
    renderFinancialReport();
    showToast('Catatan transaksi berhasil dihapus.', 'info');
  }
}

// ================= EXPENSE FORM MODAL =================
export function openExpenseModal() {
  playClick('pop');
  const nameEl = document.getElementById('expName');
  const amountEl = document.getElementById('expAmount');
  const modal = document.getElementById('expenseModal');

  if (nameEl) nameEl.value = '';
  if (amountEl) amountEl.value = '';
  if (modal) modal.classList.remove('hidden');
}

export function closeExpenseModal() {
  playClick('pop');
  const modal = document.getElementById('expenseModal');
  if (modal) modal.classList.add('hidden');
}

export function saveExpense(e) {
  if (e) e.preventDefault();
  const name = document.getElementById('expName').value.trim();
  const amount = parseInt(document.getElementById('expAmount').value, 10);
  const category = document.getElementById('expCategory').value;

  if (!name || isNaN(amount) || amount <= 0) return;

  const newExp = {
    id: 'exp_' + Date.now(),
    date: new Date().toISOString(),
    name,
    amount,
    category
  };

  state.expenses.unshift(newExp);

  saveExpenses();
  syncAddExpense(newExp);
  closeExpenseModal();
  renderFinancialReport();
}

export async function deleteExpense(id) {
  const exp = state.expenses.find(e => e.id === id);
  const expName = exp ? `${exp.name} (${formatRp(exp.amount)})` : 'ini';
  const ok = await showConfirmDialog({
    title: 'Hapus Catatan Pengeluaran',
    message: `Hapus catatan pengeluaran ${expName}?`,
    confirmText: 'Hapus Biaya',
    confirmType: 'danger',
    icon: 'delete'
  });
  if (ok) {
    state.expenses = state.expenses.filter(e => e.id !== id);
    saveExpenses();
    syncDeleteExpense(id);
    renderFinancialReport();
    showToast('Catatan pengeluaran berhasil dihapus.', 'info');
  }
}

// ================= SHARE WHATSAPP & EXPORT CSV =================
export function shareReportWhatsApp() {
  const filteredTx = filterByPeriod(state.transactions);
  const filteredExp = filterByPeriod(state.expenses);

  let totalRevenue = 0;
  let totalCash = 0;
  let totalQris = 0;
  filteredTx.forEach(t => {
    totalRevenue += t.total;
    if (t.method === 'QRIS') totalQris += t.total;
    else totalCash += t.total;
  });

  let totalExpenses = 0;
  filteredExp.forEach(e => {
    totalExpenses += e.amount;
  });

  const netProfit = totalRevenue - totalExpenses;
  const periodLabel = state.currentPeriod === 'today' ? 'Hari Ini' : (state.currentPeriod === 'month' ? 'Bulan Ini' : 'Semua Periode');
  const storeName = state.storeProfile?.name || 'Kasir UMKM';

  const message = `*REKAP LAPORAN PENJUALAN - ${storeName.toUpperCase()}*
Periode: ${periodLabel} (${formatDateFull(new Date())})

*Pemasukan (Omset)*: ${formatRp(totalRevenue)} (${filteredTx.length} Transaksi)
   • Tunai di Laci: ${formatRp(totalCash)}
   • QRIS / Transfer: ${formatRp(totalQris)}

*Total Pengeluaran*: ${formatRp(totalExpenses)}
*LABA BERSIH (UNTUNG)*: ${formatRp(netProfit)}

_Dibuat otomatis oleh Aristotle POS_
_Layanan & Bantuan: 081345028895_`;

  window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(message)}`, '_blank');
}

export function exportReportCSV() {
  const filteredTx = filterByPeriod(state.transactions);
  if (filteredTx.length === 0) {
    showToast('Tidak ada data transaksi untuk diekspor!', 'warning');
    return;
  }

  const storeSlug = (state.storeProfile?.name || 'Toko').replace(/[^a-zA-Z0-9]/g, '_');
  let csv = 'ID Transaksi,Tanggal,Nama Pesanan,Metode,Total,Uang Masuk,Kembalian,Menu Item\n';
  filteredTx.forEach(t => {
    const itemStr = t.items.map(i => `${i.qty}x ${i.name}`).join(' | ').replace(/,/g, ' ');
    csv += `"${t.id}","${t.date}","${t.orderName || 'Kasir'}","${t.method || 'TUNAI'}","${t.total}","${t.cashGiven}","${t.change}","${itemStr}"\n`;
  });

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `Laporan_${storeSlug}_AristotlePOS_${Date.now()}.csv`;
  link.click();
  link.remove();
  showToast('File Excel CSV berhasil diunduh!', 'success');
}

export function clearTransactionHistory() {
  clearAllHistory();
}

export async function clearAllHistory() {
  if (state.transactions.length === 0 && state.expenses.length === 0) {
    showToast('Riwayat transaksi dan pengeluaran sudah kosong.', 'info');
    return;
  }
  const ok = await showConfirmDialog({
    title: 'Hapus Seluruh Riwayat',
    message: 'PERINGATAN: Hapus SELURUH riwayat transaksi penjualan & pengeluaran untuk semua periode? Data tidak dapat dipulihkan kembali.',
    confirmText: 'Hapus Seluruh Data',
    confirmType: 'danger',
    icon: 'warning'
  });
  if (ok) {
    state.transactions = [];
    state.expenses = [];
    saveHistory();
    saveExpenses();
    syncClearAllHistory();
    renderFinancialReport();
    showToast('Seluruh riwayat penjualan & pengeluaran telah dikosongkan.', 'success');
  }
}
