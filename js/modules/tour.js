/**
 * Aristotle POS - Spotlight Tour Guide (Ramah Lansia)
 * Highlight langsung ke elemen UI + tooltip besar dengan animasi smooth.
 * Zero dependencies — pure CSS box-shadow spotlight trick.
 */

import { playClick } from '../utils.js';

// ponytail: box-shadow spotlight, no SVG clip-path or canvas. Upgrade if need custom shape holes.
const TOUR_STEPS = [
  {
    selector: '#appHeaderStoreTitle',
    title: '📌 Nama Toko Anda',
    desc: 'Klik nama toko ini untuk melihat info koneksi cloud, membagikan kasir ke HP lain, atau logout dari toko.',
    position: 'bottom',
    view: 'pos'
  },
  {
    selector: '#orderQueueTabs',
    title: '📋 Antrian / Meja Pelanggan',
    desc: 'Di sini tampil semua antrian aktif. Klik tab antrian untuk pindah melayani pelanggan yang berbeda.',
    position: 'bottom',
    view: 'pos',
    scrollTo: true
  },
  {
    selectorFn: () => document.querySelector('[onclick="addNewOrderQueue()"]'),
    title: '➕ Buka Antrian Baru',
    desc: 'Klik tombol ini untuk membuka antrian/meja baru tanpa menghapus pesanan yang sedang berjalan.',
    position: 'bottom',
    view: 'pos'
  },
  {
    selector: '#productGrid',
    title: '🍽️ Daftar Menu Jualan',
    desc: 'Sentuh/klik gambar menu untuk menambahkannya ke struk pesanan. Jumlah otomatis bertambah jika disentuh lagi.',
    position: 'top',
    view: 'pos',
    scrollTo: true
  },
  {
    selector: '#btnCheckout',
    title: '💰 Tombol BAYAR',
    desc: 'Setelah pesanan diisi, klik tombol BAYAR untuk memilih metode pembayaran: Tunai (kembalian otomatis) atau QRIS.',
    position: 'top',
    view: 'pos'
  },
  {
    selector: '#btnNavReportMobile, #btnNavReportDesktop',
    title: '📊 Tab Laporan & Laba',
    desc: 'Klik tab ini untuk melihat omset penjualan hari ini, catat pengeluaran belanja, dan lihat laba bersih otomatis.',
    position: 'top',
    view: null // don't auto-switch, just highlight
  },
  {
    selector: '#btnNavAdminMobile, #btnNavAdminDesktop',
    title: '📦 Tab Kelola Menu',
    desc: 'Klik tab ini untuk menambah menu baru, edit harga, atur stok porsi harian, dan pasang QRIS toko Anda.',
    position: 'top',
    view: null
  }
];

let currentStep = -1;
let spotlightEl = null;
let tooltipEl = null;
let backdropEl = null;

function ensureElements() {
  if (backdropEl) return;

  // Backdrop overlay
  backdropEl = document.createElement('div');
  backdropEl.id = 'tourBackdrop';
  backdropEl.style.cssText = 'position:fixed;inset:0;z-index:9990;background:rgba(0,0,0,0.65);opacity:0;transition:opacity 0.3s ease;pointer-events:none;';
  backdropEl.onclick = () => closeTour();
  document.body.appendChild(backdropEl);

  // Spotlight hole
  spotlightEl = document.createElement('div');
  spotlightEl.id = 'tourSpotlight';
  spotlightEl.style.cssText = 'position:fixed;z-index:9991;border-radius:16px;box-shadow:0 0 0 9999px rgba(0,0,0,0.65);transition:all 0.4s cubic-bezier(0.4,0,0.2,1);pointer-events:none;';
  document.body.appendChild(spotlightEl);

  // Tooltip
  tooltipEl = document.createElement('div');
  tooltipEl.id = 'tourTooltip';
  tooltipEl.style.cssText = `
    position:fixed;z-index:9992;
    background:#fff;border-radius:20px;
    box-shadow:0 20px 60px rgba(0,0,0,0.25), 0 0 0 1px rgba(0,0,0,0.05);
    padding:20px 22px 16px;max-width:380px;width:calc(100vw - 32px);
    opacity:0;transition:all 0.35s cubic-bezier(0.4,0,0.2,1);
    font-family:'Plus Jakarta Sans',sans-serif;
  `;
  document.body.appendChild(tooltipEl);
}

function getTargetEl(step) {
  if (step.selectorFn) return step.selectorFn();
  const selectors = step.selector.split(',').map(s => s.trim());
  for (const sel of selectors) {
    const el = document.querySelector(sel);
    if (el && el.offsetParent !== null) return el;
  }
  // Fallback: return first match even if hidden
  return document.querySelector(selectors[0]);
}

function positionSpotlight(targetEl) {
  const rect = targetEl.getBoundingClientRect();
  const pad = 8;
  spotlightEl.style.top = (rect.top - pad) + 'px';
  spotlightEl.style.left = (rect.left - pad) + 'px';
  spotlightEl.style.width = (rect.width + pad * 2) + 'px';
  spotlightEl.style.height = (rect.height + pad * 2) + 'px';
}

function positionTooltip(targetEl, position) {
  const rect = targetEl.getBoundingClientRect();
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  // Reset
  tooltipEl.style.top = '';
  tooltipEl.style.bottom = '';
  tooltipEl.style.left = '';
  tooltipEl.style.right = '';

  // Measure tooltip
  tooltipEl.style.opacity = '0';
  tooltipEl.style.display = 'block';
  const ttRect = tooltipEl.getBoundingClientRect();

  const gap = 16;

  if (position === 'bottom') {
    let top = rect.bottom + gap;
    // If tooltip goes below viewport, flip to top
    if (top + ttRect.height > vh - 20) {
      top = rect.top - ttRect.height - gap;
    }
    tooltipEl.style.top = Math.max(8, top) + 'px';
  } else {
    let top = rect.top - ttRect.height - gap;
    // If tooltip goes above viewport, flip to bottom
    if (top < 8) {
      top = rect.bottom + gap;
    }
    tooltipEl.style.top = Math.max(8, top) + 'px';
  }

  // Horizontal: center on target, clamped to viewport
  let left = rect.left + rect.width / 2 - ttRect.width / 2;
  left = Math.max(16, Math.min(left, vw - ttRect.width - 16));
  tooltipEl.style.left = left + 'px';

  // Animate in
  requestAnimationFrame(() => {
    tooltipEl.style.opacity = '1';
    tooltipEl.style.transform = 'translateY(0)';
  });
}

function renderTooltip(step, stepIdx) {
  const total = TOUR_STEPS.length;
  const isLast = stepIdx === total - 1;
  const isFirst = stepIdx === 0;

  // Progress dots
  const dots = TOUR_STEPS.map((_, i) =>
    `<span style="display:inline-block;width:${i === stepIdx ? '24px' : '8px'};height:8px;border-radius:99px;background:${i === stepIdx ? '#059669' : '#d6d3d1'};transition:all 0.3s;"></span>`
  ).join('');

  tooltipEl.innerHTML = `
    <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px;margin-bottom:10px;">
      <span style="font-size:11px;font-weight:900;color:#065f46;background:#d1fae5;border:1px solid #a7f3d0;padding:3px 10px;border-radius:99px;letter-spacing:0.5px;white-space:nowrap;">
        ${stepIdx + 1} / ${total}
      </span>
      <button id="tourCloseBtn" style="background:none;border:none;cursor:pointer;color:#a8a29e;font-size:22px;line-height:1;padding:2px 4px;border-radius:8px;transition:color 0.2s;" onmouseover="this.style.color='#1c1917'" onmouseout="this.style.color='#a8a29e'">✕</button>
    </div>
    <h3 style="font-size:18px;font-weight:900;color:#1c1917;margin:0 0 6px 0;line-height:1.3;">${step.title}</h3>
    <p style="font-size:14px;color:#57534e;font-weight:500;line-height:1.6;margin:0 0 16px 0;">${step.desc}</p>
    <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;">
      <div style="display:flex;align-items:center;gap:4px;">${dots}</div>
      <div style="display:flex;gap:8px;">
        ${!isFirst ? `<button id="tourPrevBtn" style="padding:10px 16px;border-radius:14px;border:1.5px solid #d6d3d1;background:#fff;color:#44403c;font-weight:800;font-size:13px;cursor:pointer;transition:all 0.2s;font-family:inherit;" onmouseover="this.style.background='#f5f5f4'" onmouseout="this.style.background='#fff'">← Sebelum</button>` : ''}
        <button id="tourNextBtn" style="padding:10px 20px;border-radius:14px;border:none;background:#059669;color:#fff;font-weight:900;font-size:13px;cursor:pointer;box-shadow:0 4px 12px rgba(5,150,105,0.3);transition:all 0.2s;font-family:inherit;" onmouseover="this.style.background='#047857'" onmouseout="this.style.background='#059669'">
          ${isLast ? 'Selesai ✓' : 'Lanjut →'}
        </button>
      </div>
    </div>
  `;

  // Wire up buttons
  const closeBtn = tooltipEl.querySelector('#tourCloseBtn');
  const prevBtn = tooltipEl.querySelector('#tourPrevBtn');
  const nextBtn = tooltipEl.querySelector('#tourNextBtn');

  if (closeBtn) closeBtn.addEventListener('click', (e) => { e.stopPropagation(); closeTour(); });
  if (prevBtn) prevBtn.addEventListener('click', (e) => { e.stopPropagation(); prevStep(); });
  if (nextBtn) nextBtn.addEventListener('click', (e) => { e.stopPropagation(); isLast ? closeTour() : nextStep(); });
}

function showStep(idx) {
  const step = TOUR_STEPS[idx];
  if (!step) return;
  currentStep = idx;

  // Auto-switch view before highlighting
  if (step.view && window.KasirApp && window.KasirApp.switchView) {
    // Temporarily bypass PIN protection for tour
    window.KasirApp.switchView(step.view);
  }

  // Small delay to let view render
  requestAnimationFrame(() => {
    setTimeout(() => {
      const targetEl = getTargetEl(step);
      if (!targetEl) {
        // Skip to next if element not found
        if (idx < TOUR_STEPS.length - 1) showStep(idx + 1);
        else closeTour();
        return;
      }

      // Scroll target into view if needed
      if (step.scrollTo) {
        targetEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }

      setTimeout(() => {
        positionSpotlight(targetEl);
        renderTooltip(step, idx);
        positionTooltip(targetEl, step.position);
      }, step.scrollTo ? 350 : 50);
    }, 80);
  });
}

// Reposition on scroll/resize
function handleReposition() {
  if (currentStep < 0) return;
  const step = TOUR_STEPS[currentStep];
  if (!step) return;
  const targetEl = getTargetEl(step);
  if (!targetEl) return;
  positionSpotlight(targetEl);
  positionTooltip(targetEl, step.position);
}

export function openGuideTour(stepIdx = 0) {
  playClick('pop');
  ensureElements();

  // Show backdrop
  backdropEl.style.pointerEvents = 'auto';
  requestAnimationFrame(() => { backdropEl.style.opacity = '1'; });
  spotlightEl.style.display = 'block';

  window.addEventListener('resize', handleReposition);
  window.addEventListener('scroll', handleReposition, true);

  showStep(stepIdx);
}

export function closeGuideTour() {
  closeTour();
}

function closeTour() {
  playClick('pop');
  currentStep = -1;

  if (backdropEl) {
    backdropEl.style.opacity = '0';
    backdropEl.style.pointerEvents = 'none';
  }
  if (spotlightEl) spotlightEl.style.display = 'none';
  if (tooltipEl) {
    tooltipEl.style.opacity = '0';
    tooltipEl.style.transform = 'translateY(8px)';
  }

  window.removeEventListener('resize', handleReposition);
  window.removeEventListener('scroll', handleReposition, true);
}

export function nextTourStep() { nextStep(); }
export function prevTourStep() { prevStep(); }
export function goToTourStep(idx) { showStep(idx); }

function nextStep() {
  playClick('tap');
  if (currentStep < TOUR_STEPS.length - 1) {
    showStep(currentStep + 1);
  } else {
    closeTour();
  }
}

function prevStep() {
  playClick('tap');
  if (currentStep > 0) {
    showStep(currentStep - 1);
  }
}
