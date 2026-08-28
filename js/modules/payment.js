import { state, saveHistory, saveQueues, getCurrentCart, getActiveQueue, calculateCartTotal } from '../state.js';
import { formatRp, formatDateShort, escapeHtml, showToast } from '../utils.js';
import { renderOrderQueueTabs, renderCart, renderProducts, toggleMobileCartDrawer } from './pos.js';
import { syncAddTransaction, syncSaveQueues } from '../firebase.js';
import { generateDynamicQRIS, renderQRToContainer, parseQRISMetadata } from '../qris.js';

let paymentMethod = 'cash'; // 'cash' or 'qris'
let cashGiven = 0;
let cashContributions = [];

export function renderDynamicQrisCode() {
  const { total } = calculateCartTotal();
  const qrisContainer = document.getElementById('qrisDynamicContainer');
  const qrisTotalEl = document.getElementById('qrisDynamicTotal');
  const merchantNameEl = document.getElementById('qrisMerchantName');
  const nmidEl = document.getElementById('qrisNmidDisplay');
  const acquirerEl = document.getElementById('qrisAcquirerDisplay');
  const badgeEl = document.getElementById('qrisModeBadge');

  if (qrisTotalEl) qrisTotalEl.innerText = formatRp(total);

  const meta = parseQRISMetadata(state.qrisPayload);
  if (merchantNameEl) merchantNameEl.innerText = state.storeProfile?.name || meta.merchantName || 'Kedai Usaha Mami';
  if (nmidEl) nmidEl.innerText = meta.nmid ? `NMID: ${meta.nmid}` : (state.storeProfile?.nmid ? `NMID: ${state.storeProfile.nmid}` : '');
  if (acquirerEl) acquirerEl.innerText = meta.acquirer || state.storeProfile?.acquirer || 'QRIS GPN';

  const isDynamic = state.qrisMode !== 'static';
  if (badgeEl) {
    badgeEl.innerText = isDynamic ? 'Nominal Pas' : 'Nominal Bebas';
    badgeEl.className = isDynamic 
      ? 'px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-black'
      : 'px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-black';
  }

  if (qrisContainer) {
    const payload = isDynamic ? generateDynamicQRIS(state.qrisPayload, total) : state.qrisPayload;
    renderQRToContainer(qrisContainer, payload, 220);
  }
}

export function toggleQrisPaymentMode() {
  state.qrisMode = (state.qrisMode === 'static') ? 'dynamic' : 'static';
  renderDynamicQrisCode();
}


export function openPaymentModal() {
  const { total } = calculateCartTotal();
  if (total <= 0) return;

  const totalEl = document.getElementById('payModalTotal');
  if (totalEl) totalEl.innerText = formatRp(total);

  paymentMethod = 'cash';
  setPaymentMethod('cash');

  cashGiven = 0;
  cashContributions = [];

  const manualInput = document.getElementById('cashInputManual');
  if (manualInput) manualInput.value = '';

  const keypad = document.getElementById('customKeypadArea');
  if (keypad) keypad.classList.add('hidden');

  const toggleAcc = document.getElementById('toggleAccumulateCash');
  if (toggleAcc) toggleAcc.checked = false;

  resetSplitBill();
  updateChangeDisplay();
  
  const modal = document.getElementById('paymentModal');
  if (modal) modal.classList.remove('hidden');
}

export function closePaymentModal() {
  const modal = document.getElementById('paymentModal');
  if (modal) modal.classList.add('hidden');
}

export function setPaymentMethod(method) {
  paymentMethod = method;
  const btnCash = document.getElementById('btnPayMethodCash');
  const btnQris = document.getElementById('btnPayMethodQris');
  const cashSection = document.getElementById('cashPaymentSection');
  const qrisSection = document.getElementById('qrisPaymentSection');
  const btnFinish = document.getElementById('btnFinishPayment');

  if (method === 'cash') {
    if (btnCash) btnCash.className = 'py-2.5 px-3 rounded-2xl border-2 border-emerald-600 bg-emerald-50 text-stone-950 font-black text-sm flex items-center justify-center gap-2 transition touch-target-large shadow-sm';
    if (btnQris) btnQris.className = 'py-2.5 px-3 rounded-2xl border-2 border-stone-200 bg-white text-stone-700 font-bold text-sm flex items-center justify-center gap-2 transition touch-target-large';
    if (cashSection) cashSection.classList.remove('hidden');
    if (qrisSection) qrisSection.classList.add('hidden');
    updateChangeDisplay();
  } else {
    if (btnQris) btnQris.className = 'py-2.5 px-3 rounded-2xl border-2 border-emerald-600 bg-emerald-50 text-stone-950 font-black text-sm flex items-center justify-center gap-2 transition touch-target-large shadow-sm';
    if (btnCash) btnCash.className = 'py-2.5 px-3 rounded-2xl border-2 border-stone-200 bg-white text-stone-700 font-bold text-sm flex items-center justify-center gap-2 transition touch-target-large';
    if (cashSection) cashSection.classList.add('hidden');
    if (qrisSection) qrisSection.classList.remove('hidden');
    if (btnFinish) btnFinish.disabled = false; // QRIS is instantly marked paid
    renderDynamicQrisCode();
  }
}

export function calculateSplitBill(persons) {
  const { total } = calculateCartTotal();
  const perPerson = Math.ceil(total / persons);
  const banner = document.getElementById('splitResultBanner');
  const btnReset = document.getElementById('btnResetSplit');

  if (banner) {
    banner.innerHTML = `
      <div class="flex items-center justify-between text-emerald-950">
        <span>${persons} Orang:</span>
        <span class="text-sm font-black text-emerald-800">${formatRp(perPerson)} / orang</span>
      </div>
    `;
    banner.classList.remove('hidden');
  }
  if (btnReset) btnReset.classList.remove('hidden');

  const toggleAcc = document.getElementById('toggleAccumulateCash');
  if (toggleAcc) toggleAcc.checked = true;
}

export function resetSplitBill() {
  const banner = document.getElementById('splitResultBanner');
  const btnReset = document.getElementById('btnResetSplit');
  if (banner) banner.classList.add('hidden');
  if (btnReset) btnReset.classList.add('hidden');
}

export function selectQuickCash(amount) {
  const { total } = calculateCartTotal();
  const toggleAcc = document.getElementById('toggleAccumulateCash');
  const isAccumulate = toggleAcc ? toggleAcc.checked : false;
  
  let incomingVal = 0;
  if (amount === 'exact') {
    incomingVal = isAccumulate ? (total - cashGiven) : total;
    if (incomingVal < 0) incomingVal = 0;
  } else {
    incomingVal = amount;
  }

  if (isAccumulate) {
    cashContributions.push(incomingVal);
    cashGiven += incomingVal;
  } else {
    cashContributions = [incomingVal];
    cashGiven = incomingVal;
  }

  const manualInput = document.getElementById('cashInputManual');
  if (manualInput) manualInput.value = cashGiven;
  renderCashContributions();
  updateChangeDisplay();
}

export function renderCashContributions() {
  const area = document.getElementById('cashContributionsArea');
  const list = document.getElementById('cashContributionList');
  if (!area || !list) return;

  if (cashContributions.length > 1) {
    area.classList.remove('hidden');
    list.innerHTML = cashContributions.map((c, i) => `
      <span class="px-1.5 py-0.5 bg-white rounded border border-stone-300 text-stone-700">
        Org ${i+1}: ${formatRp(c)}
      </span>
    `).join(' + ');
  } else {
    area.classList.add('hidden');
  }
}

export function toggleCustomKeypad() {
  const keypad = document.getElementById('customKeypadArea');
  if (!keypad) return;
  keypad.classList.toggle('hidden');
  if (!keypad.classList.contains('hidden')) {
    const manualInput = document.getElementById('cashInputManual');
    if (manualInput) manualInput.focus();
  }
}

export function handleManualCashInput() {
  const manualInput = document.getElementById('cashInputManual');
  const val = parseInt(manualInput ? manualInput.value : 0, 10);
  cashGiven = isNaN(val) ? 0 : val;
  cashContributions = [cashGiven];
  renderCashContributions();
  updateChangeDisplay();
}

export function addKeypadDigit(digit) {
  const input = document.getElementById('cashInputManual');
  if (!input) return;
  input.value = (input.value || '') + digit;
  handleManualCashInput();
}

export function backspaceKeypad() {
  const input = document.getElementById('cashInputManual');
  if (!input) return;
  input.value = input.value.slice(0, -1);
  handleManualCashInput();
}

export function clearManualCash() {
  const input = document.getElementById('cashInputManual');
  if (input) input.value = '';
  cashGiven = 0;
  cashContributions = [];
  renderCashContributions();
  updateChangeDisplay();
}

export function updateChangeDisplay() {
  if (paymentMethod === 'qris') return;

  const { total } = calculateCartTotal();
  const change = cashGiven - total;
  const btnFinish = document.getElementById('btnFinishPayment');
  const changeDisplay = document.getElementById('changeDisplay');
  const cashGivenDisplay = document.getElementById('cashGivenDisplay');
  const changeNotice = document.getElementById('changeNotice');

  if (cashGivenDisplay) cashGivenDisplay.innerText = formatRp(cashGiven);

  if (cashGiven >= total && total > 0) {
    if (changeDisplay) {
      changeDisplay.innerText = formatRp(change);
      changeDisplay.className = 'text-xl sm:text-3xl font-black text-emerald-700';
    }
    if (changeNotice) {
      changeNotice.innerText = change === 0 ? '✓ Uang pas, tidak ada kembalian' : `Kembalikan ${formatRp(change)}`;
    }
    if (btnFinish) btnFinish.disabled = false;
  } else {
    if (changeDisplay) {
      changeDisplay.innerText = cashGiven === 0 ? 'Rp 0' : `Kurang ${formatRp(total - cashGiven)}`;
      changeDisplay.className = 'text-lg sm:text-2xl font-black text-red-600';
    }
    if (changeNotice) {
      changeNotice.innerText = cashGiven === 0 ? 'Pilih nominal uang pembeli' : 'Uang masih kurang!';
    }
    if (btnFinish) btnFinish.disabled = true;
  }
}

export function completeTransaction() {
  const { total } = calculateCartTotal();
  if (total <= 0) return;

  const isQris = paymentMethod === 'qris';
  if (!isQris && cashGiven < total) return;

  const finalCash = isQris ? total : cashGiven;
  const finalChange = isQris ? 0 : (cashGiven - total);

  const currentCart = getCurrentCart();
  const activeQueue = getActiveQueue();
  const queueName = activeQueue ? activeQueue.name : 'Pesanan';

  const orderItems = Object.entries(currentCart).map(([id, qty]) => {
    const p = state.products.find(prod => prod.id === id);
    return {
      id,
      name: p ? p.name : 'Item',
      price: p ? p.price : 0,
      qty,
      subtotal: (p ? p.price : 0) * qty
    };
  });

  const newTx = {
    id: 'TX-' + Date.now(),
    date: new Date().toISOString(),
    orderName: queueName,
    method: isQris ? 'QRIS' : 'TUNAI',
    items: orderItems,
    total,
    cashGiven: finalCash,
    change: finalChange,
    contributions: (!isQris && cashContributions.length > 1) ? cashContributions : null
  };

  state.transactions.unshift(newTx);
  saveHistory();
  syncAddTransaction(newTx);
  showReceipt(newTx);

  if (activeQueue) {
    activeQueue.cart = {};
  }
  
  if (state.orderQueues.length > 1) {
    state.orderQueues = state.orderQueues.filter(q => q.id !== state.activeQueueId);
    state.activeQueueId = state.orderQueues[0].id;
  }

  saveQueues();
  syncSaveQueues(state.orderQueues);
  closePaymentModal();
  toggleMobileCartDrawer(false);
  renderOrderQueueTabs();
  renderCart();
  renderProducts();
  showToast(`Pembayaran ${formatRp(total)} Berhasil (${newTx.method})!`, 'success');
}

export function showReceipt(tx) {
  const dateEl = document.getElementById('receiptDate');
  const orderNameEl = document.getElementById('receiptOrderName');
  const paymentTypeEl = document.getElementById('receiptPaymentType');
  const itemListEl = document.getElementById('receiptItemList');
  const totalEl = document.getElementById('receiptTotal');
  const cashRow = document.getElementById('receiptCashRow');
  const changeRow = document.getElementById('receiptChangeRow');
  const modal = document.getElementById('receiptModal');

  if (dateEl) dateEl.innerText = formatDateShort(tx.date);
  if (orderNameEl) orderNameEl.innerText = tx.orderName || 'Pesanan Kasir';
  if (paymentTypeEl) paymentTypeEl.innerText = `[${tx.method || 'TUNAI'}]`;

  if (itemListEl) {
    itemListEl.innerHTML = tx.items.map(item => `
      <div class="flex justify-between py-0.5">
        <span>${item.qty}x ${escapeHtml(item.name)}</span>
        <span>${formatRp(item.subtotal)}</span>
      </div>
    `).join('');
  }

  if (totalEl) totalEl.innerText = formatRp(tx.total);
  
  if (tx.method === 'QRIS') {
    if (cashRow) cashRow.style.display = 'none';
    if (changeRow) changeRow.style.display = 'none';
  } else {
    if (cashRow) {
      cashRow.style.display = 'flex';
      const cashValEl = document.getElementById('receiptCash');
      if (cashValEl) cashValEl.innerText = formatRp(tx.cashGiven);
    }
    if (changeRow) {
      changeRow.style.display = 'flex';
      const changeValEl = document.getElementById('receiptChange');
      if (changeValEl) changeValEl.innerText = formatRp(tx.change);
    }
  }

  if (modal) modal.classList.remove('hidden');
}

export function closeReceiptModal() {
  const modal = document.getElementById('receiptModal');
  if (modal) modal.classList.add('hidden');
}
