/**
 * Kasir Mami - Financial Report & Bookkeeping Module
 */

import { state, saveExpenses, saveHistory } from '../state.js';
import { formatRp, formatDateShort, formatDateFull, escapeHtml } from '../utils.js';
import { showReceipt } from './payment.js';

export function setReportPeriod(period) {
  state.currentPeriod = period;
  ['today', 'month', 'all'].forEach(p => {
    const btn = document.getElementById(`period-${p}`);
    if (btn) {
      if (p === period) {
        btn.className = 'period-btn px-3 py-1.5 rounded-lg font-extrabold text-xs sm:text-sm bg-m3-primary text-white shadow-sm transition';
      } else {
        btn.className = 'period-btn px-3 py-1.5 rounded-lg font-bold text-xs sm:text-sm text-slate-600 hover:text-slate-800 transition';
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
      topList.innerHTML = `<div class="col-span-full text-center text-slate-400 text-xs py-2 font-bold">Belum ada penjualan menu pada periode ini</div>`;
    } else {
      topList.innerHTML = sortedItems.map(([name, qty], idx) => `
        <div class="bg-amber-50/70 border border-amber-200/80 p-2 rounded-xl flex items-center justify-between">
          <div class="truncate">
            <span class="text-[10px] font-black text-amber-800">#${idx + 1}</span>
            <p class="font-extrabold text-slate-800 text-xs truncate">${escapeHtml(name)}</p>
          </div>
          <span class="px-2 py-0.5 bg-amber-200 text-amber-900 font-black text-xs rounded-lg">${qty}x</span>
        </div>
      `).join('');
    }
  }

  // 3. Render Riwayat Penjualan
  const txContainer = document.getElementById('txHistoryCardList');
  if (txContainer) {
    if (filteredTx.length === 0) {
      txContainer.innerHTML = `<div class="py-6 text-center text-slate-400 font-bold text-xs">Belum ada transaksi penjualan di periode ini</div>`;
    } else {
      txContainer.innerHTML = filteredTx.map(tx => {
        const dateStr = formatDateShort(tx.date);
        const summaryItems = tx.items.map(i => `${i.qty}x ${escapeHtml(i.name)}`).join(', ');

        return `
          <div class="py-2 flex items-center justify-between gap-1.5 hover:bg-slate-50">
            <div class="min-w-0 flex-1">
              <div class="flex items-center gap-1.5 flex-wrap">
                <span class="font-black text-slate-800 text-xs sm:text-sm">${formatRp(tx.total)}</span>
                <span class="text-[10px] text-slate-400 font-bold">${dateStr}</span>
                <span class="text-[9px] ${tx.method === 'QRIS' ? 'bg-teal-100 text-teal-800' : 'bg-slate-100 text-slate-600'} font-black px-1.5 py-0.2 rounded">${tx.method || 'TUNAI'}</span>
              </div>
              <p class="text-[11px] text-slate-500 truncate mt-0.5">${summaryItems}</p>
            </div>
            <button onclick='window.KasirApp.reprintTx("${tx.id}")' class="p-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold transition shrink-0 touch-target-large" title="Lihat/Cetak Struk">
              <span class="material-symbols-rounded text-base">receipt</span>
            </button>
          </div>
        `;
      }).join('');
    }
  }

  // 4. Render Riwayat Pengeluaran
  const expContainer = document.getElementById('expenseHistoryList');
  if (expContainer) {
    if (filteredExp.length === 0) {
      expContainer.innerHTML = `<div class="py-6 text-center text-slate-400 font-bold text-xs">Belum ada catatan pengeluaran di periode ini</div>`;
    } else {
      expContainer.innerHTML = filteredExp.map(exp => {
        const dateStr = formatDateShort(exp.date);
        return `
          <div class="py-2 flex items-center justify-between gap-1.5 hover:bg-slate-50">
            <div class="min-w-0 flex-1">
              <div class="flex items-center gap-1.5">
                <span class="font-black text-red-600 text-xs sm:text-sm">- ${formatRp(exp.amount)}</span>
                <span class="text-[10px] text-slate-400 font-bold">${dateStr}</span>
              </div>
              <p class="text-[11px] font-bold text-slate-700 truncate mt-0.5">${escapeHtml(exp.name)} <span class="text-[10px] text-slate-400 font-normal">(${escapeHtml(exp.category)})</span></p>
            </div>
            <button onclick="window.KasirApp.deleteExpense('${exp.id}')" class="p-1 rounded-lg text-red-500 hover:bg-red-50 font-bold transition" title="Hapus catatan">
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

// ================= EXPENSE FORM MODAL =================
export function openExpenseModal() {
  const nameEl = document.getElementById('expName');
  const amountEl = document.getElementById('expAmount');
  const modal = document.getElementById('expenseModal');

  if (nameEl) nameEl.value = '';
  if (amountEl) amountEl.value = '';
  if (modal) modal.classList.remove('hidden');
}

export function closeExpenseModal() {
  const modal = document.getElementById('expenseModal');
  if (modal) modal.classList.add('hidden');
}

export function saveExpense(e) {
  if (e) e.preventDefault();
  const name = document.getElementById('expName').value.trim();
  const amount = parseInt(document.getElementById('expAmount').value, 10);
  const category = document.getElementById('expCategory').value;

  if (!name || isNaN(amount) || amount <= 0) return;

  state.expenses.unshift({
    id: 'exp_' + Date.now(),
    date: new Date().toISOString(),
    name,
    amount,
    category
  });

  saveExpenses();
  closeExpenseModal();
  renderFinancialReport();
}

export function deleteExpense(id) {
  if (confirm('Hapus catatan pengeluaran ini?')) {
    state.expenses = state.expenses.filter(e => e.id !== id);
    saveExpenses();
    renderFinancialReport();
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

  const message = `📊 *LAPORAN KASIR MAMI* (${periodLabel})
Tanggal: ${formatDateFull(new Date())}

💰 *Pemasukan (Omset)*: ${formatRp(totalRevenue)} (${filteredTx.length} Transaksi)
   • Tunai di Laci: ${formatRp(totalCash)}
   • QRIS/Transfer: ${formatRp(totalQris)}

🛒 *Total Pengeluaran*: ${formatRp(totalExpenses)}
🏆 *LABA BERSIH (Untung)*: ${formatRp(netProfit)}

_Laporan otomatis dibuat dari Kasir Mami POS_`;

  window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(message)}`, '_blank');
}

export function exportReportCSV() {
  const filteredTx = filterByPeriod(state.transactions);
  if (filteredTx.length === 0) {
    alert('Tidak ada data transaksi untuk diekspor!');
    return;
  }

  let csv = 'ID Transaksi,Tanggal,Nama Pesanan,Metode,Total,Uang Masuk,Kembalian,Menu Item\n';
  filteredTx.forEach(t => {
    const itemStr = t.items.map(i => `${i.qty}x ${i.name}`).join(' | ').replace(/,/g, ' ');
    csv += `"${t.id}","${t.date}","${t.orderName || 'Kasir'}","${t.method || 'TUNAI'}","${t.total}","${t.cashGiven}","${t.change}","${itemStr}"\n`;
  });

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `Laporan_Kasir_Mami_${Date.now()}.csv`;
  link.click();
}

export function clearTransactionHistory() {
  if (state.transactions.length === 0) return;
  if (confirm('Hapus seluruh riwayat penjualan?')) {
    state.transactions = [];
    saveHistory();
    renderFinancialReport();
  }
}
